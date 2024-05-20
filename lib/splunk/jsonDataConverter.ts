import {
  getDefaultDashboardPanelData,
  getInitialDashboardData,
} from "../commons/common.js";
import type { O2Dashboard } from "../schema/openobserve.js";
import { openai, queryPrompt, systemPrompt } from "./prompt.js";

const warningErrorList = {
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

const getChartType = (chartType: any, panelTitle: any) => {
  switch (chartType) {
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
    case "table":
      return "table";
    case "metric":
    case "single":
    case "singlevalue":
    case "singlevalueradial":
      return "metric";
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

const convertSPLQueryToO2Query = async (
  panelData: any,
  splQuery: any,
  openaiInstance: any
) => {
  const response: any = await openaiInstance.chat.completions.create({
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

export const convertSplunkJSONToO2 = async (
  splunkJSONStr: any,
  openaiInstance: any
) => {
  const splunkJSON: any = JSON.parse(splunkJSONStr ?? "{}") ?? {};

  // reset warning and error list
  warningErrorList.warning = {};
  warningErrorList.error = {};

  const o2Dashboard: O2Dashboard = getInitialDashboardData();

  let layoutYValue = 0;
  let panelCount = 0;

  // dashboard title
  o2Dashboard.title = splunkJSON?.title ?? "Dashboard Title";

  // dashboard description
  o2Dashboard.description = splunkJSON?.description ?? "";

  // panels
  for (const visualizationsKey in splunkJSON?.visualizations) {
    const panel: any = splunkJSON?.visualizations[visualizationsKey];

    const panelData: any = getDefaultDashboardPanelData();

    // default panel title
    panelData.title = "Panel Title";
    if (panel?.title) panelData.title = panel?.title;

    let splQuery = "";

    // get chart type
    panelData.type =
      getChartType(panel.type.split(".").pop(), panelData.title) ?? "bar";

    splQuery =
      splunkJSON?.dataSources[panel?.dataSources?.primary].options.query ?? "";

    if (splQuery) {
      const isSuccess = await convertSPLQueryToO2Query(
        panelData,
        splQuery,
        openaiInstance
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

  return {
    dashboard: o2Dashboard,
    warningErrorList,
  };
};
