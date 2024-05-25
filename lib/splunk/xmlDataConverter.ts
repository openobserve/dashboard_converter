import { parseString } from "xml2js";
import {
  getDefaultDashboardPanelData,
  getInitialDashboardData,
} from "../commons/common.js";
import { queryPrompt, systemPrompt, variableQueryPrompt } from "./prompt.js";

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

  if (
    !response ||
    response.error ||
    !(response.choices && response?.choices[0]?.message)
  ) {
    addWarningOrErrorBasedOnPanel(
      JSON.stringify(response?.error?.message),
      "error",
      panelData.title
    );
    return false;
  }

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

    // custom query
    panelData.queries[0].customQuery = true;

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

const getVariablesData = async (
  splQuery: any,
  variableData: any,
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
        content: variableQueryPrompt.replace(
          "%%QUERYPLACEHOLDER%%",
          splQuery ?? ""
        ),
      },
    ],
    temperature: 0,
    model: process.env.OPENAI_GPT_MODEL ?? "gpt-4",
  });

  if (
    !response ||
    response.error ||
    !(response.choices && response?.choices[0]?.message)
  ) {
    addWarningOrErrorBasedOnPanel(
      JSON.stringify(response?.error?.message),
      "error",
      "dashboard"
    );
    return false;
  }

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
          addWarningOrErrorBasedOnPanel(warning, "warning", "dashboard");
        }
      );
      queryConversionResponse?.warningAndErrorList?.errors?.forEach(
        (error: any) => {
          addWarningOrErrorBasedOnPanel(error, "error", "dashboard");
        }
      );
    }

    // set variable query data
    variableData.query_data = queryConversionResponse.query_data;

    return true;
  }
};

export const convertSplunkXMLToO2 = async (
  splunkXML: any,
  openaiInstance: any
) => {
  // reset warning and error list
  warningErrorList.warning = {};
  warningErrorList.error = {};

  return await new Promise((resolve, reject) => {
    const panelPromises: any = [];
    const o2Dashboard: any = getInitialDashboardData();
    parseString(
      splunkXML,
      { trim: true },
      async (err: any, splunkJSON: any) => {
        if (err) {
          reject("Error: Invalid XML format");
        }

        let layoutYValue = 0;
        let panelCount = 0;

        // dashboard title
        o2Dashboard.title = splunkJSON?.form?.label
          ? splunkJSON?.form?.label[0] ?? "Dashboard Title"
          : (splunkJSON?.dashboard?.label
              ? splunkJSON?.dashboard?.label[0]
              : "Dashboard Title") ?? "Dashboard Title";

        // dashboard description
        if (splunkJSON?.form?.description)
          o2Dashboard.description =
            splunkJSON?.form?.description[0] ??
            splunkJSON?.dashboard?.description[0] ??
            "";

        // panels
        if (splunkJSON?.form?.row ?? splunkJSON?.dashboard?.row) {
          for (const panelArr of splunkJSON?.form?.row ??
            splunkJSON?.dashboard?.row) {
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
                const panelPromise = convertSPLQueryToO2Query(
                  panelData,
                  splQuery,
                  openaiInstance
                ).then((isSuccess) => {
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
                });
                panelPromises.push(panelPromise);
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

        // variables
        if (
          splunkJSON?.form?.fieldset &&
          splunkJSON?.form?.fieldset[0]?.input
        ) {
          // loop on each input
          for (const inputKey in splunkJSON?.form?.fieldset[0]?.input) {
            const variableData: any = {
              name: "",
              label: "",
              type: "",
              query_data: {
                stream_type: "",
                stream: "",
                field: "",
                max_record_size: null,
                filter: [],
              },
              value: "",
              options: [],
            };

            if (
              ["dropdown", "text", "radio"].includes(
                splunkJSON?.form?.fieldset[0]?.input[inputKey]["$"].type
              )
            ) {
              // assign label and name
              variableData.label =
                splunkJSON?.form?.fieldset[0]?.input[inputKey].label[0] ?? "";
              variableData.name =
                splunkJSON?.form?.fieldset[0]?.input[inputKey]["$"].token ?? "";

              switch (
                splunkJSON?.form?.fieldset[0]?.input[inputKey]["$"].type
              ) {
                case "dropdown":
                case "radio": {
                  // check if query available
                  if (
                    splunkJSON?.form?.fieldset[0]?.input[inputKey]?.search &&
                    splunkJSON?.form?.fieldset[0]?.input[inputKey]?.search[0] &&
                    splunkJSON?.form?.fieldset[0]?.input[inputKey]?.search[0]
                      .query &&
                    splunkJSON?.form?.fieldset[0]?.input[inputKey]?.search[0]
                      ?.query[0]
                  ) {
                    // assign type
                    variableData.type = "query_values";

                    const splQuery =
                      splunkJSON?.form?.fieldset[0]?.input[inputKey]?.search[0]
                        ?.query[0];

                    if (splQuery) {
                      const queryPrompt = getVariablesData(
                        splQuery,
                        variableData,
                        openaiInstance
                      ).then((isSuccess) => {
                        if (isSuccess) {
                          // push variable
                          o2Dashboard.variables.list.push(variableData);
                        }
                      });

                      panelPromises.push(queryPrompt);
                    } else {
                      // can not find query
                      addWarningOrErrorBasedOnPanel(
                        "can not find query. skipping..",
                        "error",
                        "dashboard"
                      );
                    }
                    break;
                  }

                  // check if options available
                  if (splunkJSON?.form?.fieldset[0]?.input[inputKey].choice) {
                    // get options
                    variableData.options = splunkJSON?.form?.fieldset[0]?.input[
                      inputKey
                    ].choice
                      .map((option: any) => {
                        return {
                          label: option["_"],
                          value: option["$"].value,
                        };
                      })
                      .filter((option: any) => {
                        return option.label != "ALL" && option.value !== "*";
                      });
                    variableData.type = "custom";

                    // remove query_data if type is not query_values
                    if (variableData.type !== "query_values") {
                      delete variableData["query_data"];
                    }

                    // push variable
                    o2Dashboard.variables.list.push(variableData);
                    break;
                  }

                  break;
                }
                case "text": {
                  variableData.type = "textbox";

                  variableData.value =
                    splunkJSON?.form?.fieldset[0]?.input[inputKey].default[0] ??
                    "";

                  // remove query_data if type is not query_values
                  if (variableData.type !== "query_values") {
                    delete variableData["query_data"];
                  }

                  // push variable
                  o2Dashboard.variables.list.push(variableData);
                  break;
                }
              }
            } else {
              addWarningOrErrorBasedOnPanel(
                `Unsupported variable type: ${splunkJSON?.form?.fieldset[0]?.input[inputKey]["$"].type}`,
                "error",
                "dashboard"
              );
            }
          }
        }

        await Promise.all(panelPromises);

        return resolve({
          dashboard: o2Dashboard,
          warningErrorList,
        });
      }
    );
  });
};
