import { parseString } from "xml2js";
import {
  getDefaultDashboardPanelData,
  getInitialDashboardData,
} from "../commons/common.js";
import type { O2Dashboard } from "../schema/openobserve.js";
import { openai, queryPrompt, systemPrompt } from "./prompt.js";

const warningErrorList: any = {
  warning: {},
  error: {},
};

const addWarningOrErrorBasedOnPanel = (
  message: any,
  fieldKey: any,
  panelName: any
) => {
  if (!warningErrorList[fieldKey][panelName]) {
    warningErrorList[fieldKey][panelName] = new Set();
  } else {
    warningErrorList[fieldKey][panelName].add(message);
  }
};

const getChartType = (chartObj: any, panelTitle: any) => {
  switch (chartObj._) {
    case "column":
    case "bar":
      return "bar";
    case "line":
      return "line";
    case "area":
      return "area";
    case "scatter":
    case "bubble":
      return "scatter";
    case "pie":
      return "pie";
    case "radialGauge":
    case "fillerGauge":
    case "markerGauge":
      return "gauge";
    default:
      break;
  }

  addWarningOrErrorBasedOnPanel(
    "Can not find chart type. Using default chart type: bar",
    "warning",
    panelTitle
  );

  return "bar";
};

const convertSPLQueryToO2Query = async (panelData: any, splQuery: any) => {
  const response: any = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: queryPrompt.replace("%%QUERYPLACEHOLDER%%", splQuery ?? ""),
      },
    ],
    temperature: 0,
    model: process.env.OPENAI_GPT_MODEL ?? "gpt-4",
  });

  response.choices[0].message.content =
    response.choices[0].message.content.replace(/^```|```$/g, "");

  const queryConversionResponse = JSON.parse(
    response.choices[0].message.content ?? "{}"
  );

  if (queryConversionResponse.status == "success") {
    // check if queryConversionResponse has warning or error
    if (queryConversionResponse.warningAndErrorList) {
      queryConversionResponse?.warningAndErrorList?.warnings?.forEach(
        (warning: any) => {
          addWarningOrErrorBasedOnPanel(warning, "warning", panelData.title);
        }
      );
      queryConversionResponse?.warningAndErrorList?.errors?.forEach(
        (error: any) => {
          addWarningOrErrorBasedOnPanel(error, "error", panelData.title);
        }
      );
    }

    // query
    panelData.queries[0].query = queryConversionResponse.query ?? "";

    panelData.queries[0].fields.stream =
      queryConversionResponse.fields.stream ?? "default";

    panelData.queries[0].fields.x = queryConversionResponse.fields.x ?? [];

    panelData.queries[0].fields.y = queryConversionResponse.fields.y ?? [];

    return true;
  } else {
    // error while converting query
    addWarningOrErrorBasedOnPanel(
      queryConversionResponse.message,
      "error",
      panelData.title
    );

    return false;
  }
};

export const convertSplunkXMLToO2 = async (SplunkXML: any) => {
  console.log("XML: ", SplunkXML);

  // reset warning and error list
  warningErrorList.warning = {};
  warningErrorList.error = {};

  return await new Promise((resolve, reject) => {
    const o2Dashboard: O2Dashboard = getInitialDashboardData();
    console.log("o2Dashboard: xmlDataConverter ", o2Dashboard);
    
    parseString(
      SplunkXML,
      { trim: true },
      async (err: any, SplunkJSON: any) => {
        if (err) {
          reject("Error: Invalid XML format");
        }
        
        let layoutYValue = 0;
        let panelCount = 0;
        console.log("o2Dashboard: ", o2Dashboard);
        console.log("SplunkJSON: ", SplunkJSON);
        console.log("SplunnkXML: ", SplunkXML);

        // dashboard title
        o2Dashboard.title = SplunkJSON?.form?.label
          ? SplunkJSON?.form?.label[0] ?? "Dashboard Title"
          : (SplunkJSON?.dashboard?.label
              ? SplunkJSON?.dashboard?.label[0]
              : "Dashboard Title") ?? "Dashboard Title";

        // dashboard description
        if (SplunkJSON?.form?.description)
          o2Dashboard.description =
            SplunkJSON?.form?.description[0] ??
            SplunkJSON?.dashboard?.description[0] ??
            "";

        // panels
        if (SplunkJSON?.form?.row ?? SplunkJSON?.dashboard?.row) {
          for (const panelArr of SplunkJSON?.form?.row ??
            SplunkJSON?.dashboard?.row) {
            for (const panel of panelArr.panel) {
              const panelData: any = getDefaultDashboardPanelData();

              // default panel title
              panelData.title = "Panel Title";
              if (panel?.title) panelData.title = panel?.title[0];

              let splQuery = "";

              if (panel.chart) {
                // some schema has panel name in chart object
                if (panel.chart[0].title)
                  panelData.title = panel.chart[0].title[0];

                // get chart type
                // common charts
                const chartTypeObj = panel.chart[0].option.find(
                  (option: any) => option.$.name === "charting.chart"
                );

                // convert splunk chart type to o2 chart type
                panelData.type = getChartType(chartTypeObj, panelData.title);

                // get chart query
                splQuery = panel.chart[0]?.search[0]?.query[0] ?? "";
              } else if (panel.table) {
                panelData.type = "table";

                // get chart query
                splQuery = panel.table[0]?.search[0]?.query[0] ?? "";

                // table chart
              } else if (panel.event) {
                panelData.type = "table";

                // get chart query
                splQuery = panel.event[0]?.search[0]?.query[0] ?? "";

                // event chart -> table chart
              } else if (panel.single) {
                panelData.type = "metric";

                // get chart query
                splQuery = panel.single[0]?.search[0]?.query[0] ?? "";
              }

              if (splQuery) {
                const isSuccess = await convertSPLQueryToO2Query(
                  panelData,
                  splQuery
                );
                if (isSuccess) {
                  // layout
                  panelData.layout = {
                    x: panelCount % 2 == 0 ? 0 : 24,
                    y: layoutYValue++,
                    w: 24,
                    h: 9,
                    i: panelCount++,
                  };

                  // push panel
                  o2Dashboard.tabs[0].panels.push(panelData);
                }
              } else {
                // can not find query

                addWarningOrErrorBasedOnPanel(
                  "can not find query. skipping..",
                  "error",
                  panelData.title
                );
              }
            }
          }
        }
        console.log("o2Dashboard: ", o2Dashboard);

        return resolve({
          dashboard: o2Dashboard,
          warningErrorList,
        });
      }
    );
  });
};
