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
export const convertSplunkJSONToO2 = async (
  splunkJSONStr: any,
  openaiInstance: any
) => {
  const panelPromises: any = [];
  const splunkJSON: any = JSON.parse(splunkJSONStr ?? "{}") ?? {};

  // reset warning and error list
  warningErrorList.warning = {};
  warningErrorList.error = {};

  const o2Dashboard: any = getInitialDashboardData();

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

  // variables
  if (splunkJSON.inputs) {
    // loop on each input
    for (const inputKey in splunkJSON.inputs) {
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
        ["input.dropdown", "input.text"].includes(
          splunkJSON.inputs[inputKey].type
        )
      ) {
        // assign label and name
        variableData.label = splunkJSON.inputs[inputKey].title ?? "";
        variableData.name = splunkJSON.inputs[inputKey].options.token ?? "";

        switch (splunkJSON.inputs[inputKey].type) {
          case "input.dropdown": {
            // check if datasource available
            if (splunkJSON.inputs[inputKey].dataSources) {
              // assign type
              variableData.type = "query_values";

              // get datasourceId
              const datasourceId =
                splunkJSON.inputs[inputKey].dataSources.primary;

              // get all dashboard datasource
              const allDatasources = splunkJSON.dataSources;

              // get datasource object based on Id
              const datasource = allDatasources[datasourceId];

              if (datasource) {
                const splQuery = datasource.options.query;

                if (splQuery) {
                  const panelPromise = getVariablesData(
                    splQuery,
                    variableData,
                    openaiInstance
                  ).then((isSuccess) => {
                    if (isSuccess) {
                      // push variable
                      o2Dashboard.variables.list.push(variableData);
                    }
                  });

                  panelPromises.push(panelPromise);
                } else {
                  // can not find query
                  addWarningOrErrorBasedOnPanel(
                    "can not find query. skipping..",
                    "error",
                    "dashboard"
                  );
                }
              }
              break;
            }
            // check if options available
            if (splunkJSON.inputs[inputKey].options) {
              // get options
              variableData.options = splunkJSON.inputs[
                inputKey
              ].options.items.filter((option: any) => {
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
          case "input.text": {
            variableData.type = "textbox";
            variableData.value =
              splunkJSON.inputs[inputKey].options.defaultValue;

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
          `Unsupported variable type: ${splunkJSON.inputs[inputKey].type}`,
          "error",
          "dashboard"
        );
      }
    }
  }

  await Promise.all(panelPromises);

  return {
    dashboard: o2Dashboard,
    warningErrorList,
  };
};
