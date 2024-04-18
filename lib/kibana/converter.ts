import {
  getDefaultDashboardPanelData,
  getInitialDashboardData,
  sqlchart,
} from "../commons/common";
import type { O2Dashboard } from "../schema/openobserve";

const kibanaToO2ChartType: any = {
  metric: "metric",
  table: "table",
  bar_horizontal: "h-bar",
  bar_horizontal_percentage: "h-stacked",
  bar_horizontal_stacked: "h-stacked",
  bar: "bar",
  bar_stacked: "stacked",
  bar_stacked_percentage: "stacked",
  bar_percentage_stacked: "stacked",
  area: "area",
  area_stacked: "area-stacked",
  area_stacked_percentage: "area-stacked",
  line: "line",
  donut: "donut",
  pie: "pie",
  gauge: "gauge",
  heatmap: "heatmap",
};

const getKibanaChartType = (panelData: any, errorAndWarningList: any) => {
  // first, check if there is a preferred chart type
  // else if check if there is a visualization type
  // else default to bar
  if (
    panelData?.embeddableConfig?.attributes?.state?.visualization
      ?.preferredSeriesType
  ) {
    const preferredSeriesType =
      kibanaToO2ChartType[
        panelData?.embeddableConfig?.attributes?.state?.visualization
          ?.preferredSeriesType
      ];
    if (preferredSeriesType) {
      return preferredSeriesType;
    } else {
      errorAndWarningList.warningList.push(
        `Warning: ${
          panelData?.title ??
          panelData?.embeddableConfig?.attributes?.title ??
          panelData?.attributes?.title
        } -> Can not find preferred series type, using default chart type: bar`
      );
      // if preferred series type is not found
      return "bar";
    }
  } else if (
    panelData?.embeddableConfig?.attributes?.visualizationType == "lnsPie"
  ) {
    // if visualization type is found
    // then check its shape
    if (
      panelData?.embeddableConfig?.attributes?.state?.visualization?.shape ==
      "donut"
    ) {
      return "donut";
    }
    return "pie";
  } else if (
    panelData?.embeddableConfig?.attributes?.visualizationType == "lnsMetric"
  ) {
    return "metric";
  } else if (
    panelData?.embeddableConfig?.attributes?.visualizationType == "lnsDatatable"
  ) {
    return "table";
  } else {
    errorAndWarningList.warningList.push(
      `Warning: ${
        panelData?.title ??
        panelData?.embeddableConfig?.attributes?.title ??
        panelData?.attributes?.title
      } -> Can not find chart type, using default chart type: bar`
    );
    // if visualization type is not found, then default to bar
    return "bar";
  }
};

const kibanaToO2AggregationFunction: any = {
  count: "count",
  unique_count: "count-distinct",
  sum: "sum",
  avg: "avg",
  min: "min",
  max: "max",
};

const extractKibanaData = (kibanaJSON: any, errorAndWarningList: any) => {
  const kibanaData: any = {
    dashboard: [],
    index_pattern: [],
    indexPatternMap: {},
    panels: [],
  };

  kibanaJSON.forEach((kibana: any) => {
    switch (kibana.type) {
      case "dashboard": {
        try {
          // panelsJSON will be in stringify format, so we need to parse it
          kibana.attributes.panelsJSON = JSON.parse(
            kibana.attributes.panelsJSON ?? "[]"
          );
          kibanaData.dashboard.push(kibana);
        } catch (error) {
          errorAndWarningList.errorList.push(
            `Error: failed to parse PanelsJSON`
          );
        }

        break;
      }
      case "index-pattern": {
        kibanaData.index_pattern.push(kibana);
        kibanaData.indexPatternMap[kibana.id] = kibana.attributes.title;
        break;
      }
      case "visualization":
      case "lens": {
        // migrate attributes into embeddableConfig
        kibana.embeddableConfig = {};
        kibana.embeddableConfig.attributes = kibana.attributes;
        kibanaData.panels.push(kibana);
        break;
      }
      default: {
        if (kibana.type) {
          // ignore search, map and others types
          errorAndWarningList.errorList.push(
            `Error: chart with type ${
              kibana.type ?? ""
            } is not supported for conversion (skipping)`
          );
        }
        break;
      }
    }
  });

  // if panels are empty, use dashboard panels
  if (kibanaData.panels.length === 0) {
    kibanaData.dashboard.forEach((dashboard: any) => {
      // copy dashboard panels
      kibanaData.panels.push(...dashboard.attributes.panelsJSON);
    });
  } else {
    // need to add gridData from panelsJSON
    kibanaData.panels.forEach((panel: any) => {
      const panelIndex = kibanaData?.dashboard[0]?.references
        ?.find((dashboardPanel: any) => dashboardPanel.id === panel.id)
        ?.name.split(":")[0];

      panel.gridData = kibanaData?.dashboard[0]?.attributes?.panelsJSON.find(
        (dashboardPanel: any) => dashboardPanel?.panelIndex === panelIndex
      )?.gridData;
    });
  }

  return kibanaData;
};

const setLegendConfig = (panel: any, panelData: any) => {
  // check for show legend option
  panelData.config.show_legends =
    panel?.embeddableConfig?.attributes?.state?.visualization?.legend
      ?.isVisible ?? true;

  // check for legend position
  // openobserve only supports right and bottom
  panelData.config.legends_position =
    panel?.embeddableConfig?.attributes?.state?.visualization?.legend
      ?.verticalAlignment === "bottom" ||
    panel?.embeddableConfig?.attributes?.state?.visualization?.legend
      ?.position === "bottom"
      ? "bottom"
      : "right";
};

const getFirstLayer = (panel: any, errorAndWarningList: any) => {
  if (
    panel?.embeddableConfig?.attributes?.state?.visualization?.layers?.length >
    1
  ) {
    errorAndWarningList.warningList.push(
      `Warning: ${
        panel?.title ?? panel?.attributes?.title
      } -> More than one layer found, using first Data layer.`
    );
  }
  return (
    panel?.embeddableConfig?.attributes?.state?.visualization?.layers?.find(
      (layer: any) => {
        return layer?.layerType === "data";
      }
    ) ??
    panel?.embeddableConfig?.attributes?.state?.visualization?.layerId ??
    null
  );
};

const setFieldsBasedOnPanelType = (
  panel: any,
  panelData: any,
  kibanaData: any,
  errorAndWarningList: any
) => {
  switch (panelData.type) {
    case "h-bar":
    case "h-stacked":
    case "bar":
    case "stacked":
    case "area":
    case "area-stacked":
    case "line":
    case "donut":
    case "pie":
      {
        // get first layer from visualization
        const firstDataLayer = getFirstLayer(panel, errorAndWarningList);

        if (!firstDataLayer) {
          errorAndWarningList.errorList.push(
            `Error: ${
              panelData?.title ?? panelData?.attributes?.title
            } -> failed to get Data layer, skipping panel`
          );
          return false;
        }

        // set x, y axis
        // find first layer who has type as a data
        let kibanaColumns: any = {};

        // there will be three types of datasourceStates
        // formBased, indexpattern and textBased
        // loop on each datasourceStates
        Object.keys(
          panel?.embeddableConfig?.attributes?.state?.datasourceStates
        ).forEach((key) => {
          // if columns are found
          // then assign to kibanaColumns
          if (
            panel?.embeddableConfig?.attributes?.state?.datasourceStates[key]
              ?.layers[firstDataLayer?.layerId]?.columns
          ) {
            kibanaColumns =
              panel?.embeddableConfig?.attributes?.state?.datasourceStates[key]
                ?.layers[firstDataLayer?.layerId]?.columns ?? {};
          }
        });

        // x axis field
        let xAccessor = firstDataLayer?.xAccessor ?? null;

        // for pie, donut and metric
        // we need to get first metric
        if (
          panelData.type == "pie" ||
          panelData.type == "donut" ||
          panelData.type == "metric"
        ) {
          if (firstDataLayer.metric) {
            xAccessor = firstDataLayer.metric;
          } else if (firstDataLayer.metrics) {
            // take first metric
            xAccessor = firstDataLayer.metrics[0];
          }
        }

        // split accessor
        const splitAccessor = firstDataLayer?.splitAccessor ?? null;

        // add into x axis
        if (kibanaColumns[xAccessor]) {
          // add into x axis
          // NOTE: for timestamp field histogram function is pending
          panelData.queries[0].fields.x.push({
            label: kibanaColumns[xAccessor]?.label,
            alias: "x_axis_" + (panelData.queries[0].fields.x.length + 1),
            column: kibanaColumns[xAccessor]?.sourceField?.replace(/\./g, "_"),
            sort_by: "ASC",
          });
        }

        // add splitter as a 2nd field into x axis
        if (kibanaColumns[splitAccessor]) {
          // add into x axis as 2nd field
          panelData.queries[0].fields.x.push({
            label: kibanaColumns[splitAccessor]?.label,
            alias: "x_axis_" + (panelData.queries[0].fields.x.length + 1),
            column: kibanaColumns[splitAccessor]?.sourceField?.replace(
              /\./g,
              "_"
            ),
            sort_by: "ASC",
          });
        }

        // add y axis
        // all columns array except xAccessor and splitAccessor
        Object.keys(kibanaColumns).forEach((columnId: any) => {
          // if columnId is not equal to xAccessor or splitAccessor
          // then add it to y axis
          // also, check source field is not null
          if (
            columnId !== xAccessor &&
            columnId !== splitAccessor &&
            kibanaColumns[columnId].sourceField
          ) {
            panelData.queries[0].fields.y.push({
              label: kibanaColumns[columnId]?.label,
              alias: "y_axis_" + (panelData.queries[0].fields.y.length + 1),
              column: kibanaColumns[columnId]?.sourceField?.replace(/\./g, "_"),
              aggregationFunction:
                kibanaToO2AggregationFunction[
                  kibanaColumns[columnId].operationType
                ] ?? "count",
              sort_by: "ASC",
            });
          }
        });

        // set stream based on index pattern
        // first get index pattern id of first layer of current panel
        // then get stream name from index pattern id
        // find index pattern id, where name is indexpattern-datasource-layer-<layerId>
        const indexPatternId =
          panel?.embeddableConfig?.attributes?.references?.find((ref: any) => {
            return (
              ref.type === "index-pattern" &&
              ref.name ===
                `indexpattern-datasource-layer-${firstDataLayer?.layerId}`
            );
          })?.id ?? null;
        panelData.queries[0].fields.stream =
          kibanaData.indexPatternMap[indexPatternId] ?? "";
      }
      break;

    case "metric": {
      // get first layer from visualization
      const layerId =
        panel?.embeddableConfig?.attributes.state.visualization.layerId;

      if (!layerId) {
        errorAndWarningList.errorList.push(
          `Error: ${
            panel?.title ?? panel?.attributes?.title
          } -> failed to get Data layer, skipping panel`
        );
        return false;
      }

      const accessor =
        panel?.embeddableConfig?.attributes.state.visualization.accessor ??
        panel?.embeddableConfig?.attributes.state.visualization.metricAccessor;

      let columnData: any = [];

      Object.keys(
        panel?.embeddableConfig?.attributes?.state?.datasourceStates
      ).forEach((key) => {
        if (
          panel?.embeddableConfig?.attributes?.state?.datasourceStates[key]
            ?.layers[layerId]?.columns
        ) {
          columnData =
            panel?.embeddableConfig?.attributes?.state?.datasourceStates[key]
              ?.layers[layerId]?.columns[accessor] ?? {};
        }
      });

      panelData.queries[0].fields.y.push({
        label: columnData?.label,
        alias: "y_axis_" + (panelData.queries[0].fields.y.length + 1),
        column: columnData.sourceField.replace(/\./g, "_"),
        aggregationFunction:
          kibanaToO2AggregationFunction[columnData.operationType] ?? "count",
        sort_by: "ASC",
      });

      panelData.queries[0].fields.x = [];
      panelData.queries[0].fields.z = [];

      // set stream based on index pattern
      // first get index pattern id of first layer of current panel
      // then get stream name from index pattern id
      // find index pattern id, where name is indexpattern-datasource-layer-<layerId>
      const indexPatternId =
        panel?.embeddableConfig?.attributes?.references?.find((ref: any) => {
          return (
            ref.type === "index-pattern" &&
            ref.name === `indexpattern-datasource-layer-${layerId}`
          );
        })?.id ?? null;
      panelData.queries[0].fields.stream =
        kibanaData.indexPatternMap[indexPatternId] ?? "";
      break;
    }
    case "table": {
      // get layerId from visualization
      const layerId =
        panel?.embeddableConfig?.attributes.state?.visualization?.layerId;

      if (!layerId) {
        errorAndWarningList.errorList.push(
          `Error: ${
            panel?.title ?? panel?.attributes?.title
          } -> failed to get Data layer, skipping panel`
        );
        return false;
      }

      let kibanaColumns: any = {};
      // there will be three types of datasourceStates
      // formBased, indexpattern and textBased
      // loop on each datasourceStates
      Object.keys(
        panel?.embeddableConfig?.attributes?.state?.datasourceStates
      ).forEach((key) => {
        // if columns are found
        // then assign to kibanaColumns
        if (
          panel?.embeddableConfig?.attributes?.state?.datasourceStates[key]
            ?.layers[layerId]?.columns
        ) {
          kibanaColumns =
            panel?.embeddableConfig?.attributes?.state?.datasourceStates[key]
              ?.layers[layerId]?.columns ?? {};
        }
      });

      if (Object.keys(kibanaColumns).length == 0) {
        errorAndWarningList.errorList.push(
          `Error: ${
            panel?.title ?? panel?.attributes?.title
          } -> failed to get columns, skipping panel`
        );
      }

      // loop on each columns
      // if column dataType is number push into y axis
      // else push into x axis
      Object.keys(kibanaColumns).forEach((columnId: any) => {
        if (
          kibanaColumns[columnId].dataType == "number" &&
          kibanaColumns[columnId].sourceField
        ) {
          panelData.queries[0].fields.y.push({
            label: kibanaColumns[columnId].label,
            alias: "y_axis_" + (panelData.queries[0].fields.y.length + 1),
            column: kibanaColumns[columnId]?.sourceField?.replace(/\./g, "_"),
            aggregationFunction:
              kibanaToO2AggregationFunction[
                kibanaColumns[columnId].operationType
              ] ?? "count",
            sort_by: "ASC",
          });
        } else if (kibanaColumns[columnId].sourceField) {
          panelData.queries[0].fields.x.push({
            label: kibanaColumns[columnId].label,
            alias: "x_axis_" + (panelData.queries[0].fields.x.length + 1),
            column: kibanaColumns[columnId]?.sourceField?.replace(/\./g, "_"),
            sort_by: "ASC",
          });
        } else {
          errorAndWarningList.warningList.push(
            `Warning: ${panelData.title} -> field with label ${kibanaColumns[columnId].label} has missing sourceField, skipping column`
          );
        }
      });

      // set stream based on index pattern
      // first get index pattern id of first layer of current panel
      // then get stream name from index pattern id
      // find index pattern id, where name is indexpattern-datasource-layer-<layerId>
      const indexPatternId =
        panel?.embeddableConfig?.attributes?.references?.find((ref: any) => {
          return (
            ref.type === "index-pattern" &&
            ref.name === `indexpattern-datasource-layer-${layerId}`
          );
        })?.id ?? null;
      panelData.queries[0].fields.stream =
        kibanaData.indexPatternMap[indexPatternId] ?? "";

      break;
    }
    default:
      errorAndWarningList.errorList.push(
        `Error: ${panelData?.title ?? panelData?.attributes?.title} with type ${
          panelData.type
        } is not supported for conversion(skipping)`
      );
      return false;
  }
  return true;
};

export const convertKibanaToO2 = (kibanaJSON: any) => {
  const o2Dashboard: O2Dashboard = getInitialDashboardData();
  const errorAndWarningList: any = {
    errorList: [],
    warningList: [],
  };

  try {
    const kibanaData = extractKibanaData(kibanaJSON, errorAndWarningList);

    // convert dashboard
    if (kibanaData.dashboard.length > 0) {
      if (kibanaData.dashboard[0].attributes.title) {
        o2Dashboard.title = kibanaData.dashboard[0].attributes.title;
      } else {
        o2Dashboard.title = "Dashboard Title";
        errorAndWarningList.warningList.push(
          "Warning: Can not find dashboard title, using default title: Dashboard Title"
        );
      }
      o2Dashboard.description = kibanaData.dashboard[0].attributes.description;

      // loop on all panels
      // and push each panel into o2Dashboard
      kibanaData.panels.forEach((panel: any, panelIndex: number) => {
        const panelData = getDefaultDashboardPanelData();

        // set panel title
        // if title is not set, set default title as Panel [index]
        if (panel?.title || panel?.attributes?.title) {
          panelData.title = panel?.title ?? panel?.attributes?.title;
        } else {
          panelData.title = "Panel " + (panelIndex + 1);
          errorAndWarningList.warningList.push(
            "Warning: Can not find panel title, using default title: Panel " +
              (panelIndex + 1)
          );
        }

        switch (panel.type) {
          // currently, support for only lens type
          // ignore map, canvas, controls and other types
          case "lens": {
            // take first query type
            // openobserve only support one type per chart

            panelData.type =
              getKibanaChartType(panel, errorAndWarningList) ?? "bar";

            // set legend config
            // show_legends
            // legends_position
            setLegendConfig(panel, panelData);

            // set fields based on panel type
            const isValidFields = setFieldsBasedOnPanelType(
              panel,
              panelData,
              kibanaData,
              errorAndWarningList
            );

            // if fields is not valid then skip this panel
            if (!isValidFields) {
              break;
            }

            // take unit from first vertical axis
            // default || number   ->    default
            // percent             ->    percent(0-100)
            // bytes(1024)         ->    bytes

            if (panel.gridData) {
              // set layout
              panelData.layout = {
                x: panel?.gridData?.x ?? 0,
                y: panel?.gridData?.y ?? 0,
                w: panel?.gridData?.w ?? 24,
                h: Math.max(3, panel?.gridData?.h ?? 9 - 3),
                i: panelIndex,
              };
            } else {
              errorAndWarningList.warningList.push(
                `Warning: ${
                  panelData?.title ?? panelData?.attributes?.title
                } Can not find panel layout, using default layout`
              );

              // set default layout
              panelData.layout = {
                x: 0,
                y: 0,
                w: 24,
                h: 6,
                i: panelIndex,
              };
            }

            // make query based on fields and stream
            panelData.queries[0].query = sqlchart(panelData, 0);

            // push panel into o2Dashboard
            o2Dashboard.tabs[0].panels.push(panelData);
            break;
          }
          case "visualization": {
            console.log(panel);
            if (!panel?.embeddableConfig?.attributes?.visState) {
              errorAndWarningList.warningList.push(
                `Warning: ${
                  panelData?.title ?? panelData?.attributes?.title
                } -> Can not find visState, skipping`
              );
              break;
            }
            panel.embeddableConfig.attributes.visState = JSON.parse(
              panel?.embeddableConfig?.attributes?.visState ?? "{}"
            );

            switch (panel.embeddableConfig.attributes.visState.type) {
              case "markdown": {
                panelData.type = "markdown";
                panelData.markdownContent =
                  panel.embeddableConfig.attributes.visState.params.markdown ??
                  "";

                if (panel.gridData) {
                  // set layout
                  panelData.layout = {
                    x: panel?.gridData?.x ?? 0,
                    y: panel?.gridData?.y ?? 0,
                    w: panel?.gridData?.w ?? 24,
                    h: Math.max(3, panel?.gridData?.h ?? 9 - 3),
                    i: panelIndex,
                  };
                } else {
                  errorAndWarningList.warningList.push(
                    `Warning: ${
                      panelData?.title ?? panelData?.attributes?.title
                    } -> Can not find panel layout, using default layout`
                  );

                  // set default layout
                  panelData.layout = {
                    x: 0,
                    y: 0,
                    w: 24,
                    h: 6,
                    i: panelIndex,
                  };
                }

                // push panel into o2Dashboard
                o2Dashboard.tabs[0].panels.push(panelData);
                break;
              }
              case "metrics": {
                // console.log(panel);

                // in x axis add time field
                if (panel?.attributes?.visState?.params?.type == "timeseries") {
                  if (panel?.attributes?.visState?.params?.time_field) {
                    panelData.queries[0].fields.x.push({
                      label: panel?.attributes?.visState?.params?.time_field,
                      alias:
                        "x_axis_" + (panelData.queries[0].fields.x.length + 1),
                      column:
                        panel?.attributes?.visState?.params?.time_field?.replace(
                          /\./g,
                          "_"
                        ),
                      aggregationFunction: "histogram",
                      sort_by: "DESC",
                    });
                  }
                }

                // set metrics fields in y axis
                if (panel?.attributes?.visState?.params?.series) {
                  panel?.attributes?.visState?.params?.series.forEach(
                    (series: any) => {
                      if (series?.metrics && series?.metrics?.length > 0) {
                        panelData.queries[0].fields.y.push({
                          label:
                            series?.label ?? series?.metrics[0].field ?? " ",
                          alias:
                            "y_axis_" +
                            (panelData.queries[0].fields.y.length + 1),
                          column: series?.metrics[0].field?.replace(/\./g, "_"),
                          aggregationFunction:
                            kibanaToO2AggregationFunction[
                              series?.metrics[0].type
                            ] ?? "count",
                          sort_by: "ASC",
                        });
                      }
                    }
                  );
                }

                // panel type will be set from first series
                panelData.type =
                  panel?.attributes?.visState?.params?.series[0].chart_type ??
                  "bar";

                // set default layout
                panelData.layout = {
                  x: 0,
                  y: 0,
                  w: 24,
                  h: 6,
                  i: panelIndex,
                };

                // make query based on fields and stream
                panelData.queries[0].query = sqlchart(panelData, 0);

                // push panel into o2Dashboard
                o2Dashboard.tabs[0].panels.push(panelData);
                break;
              }
              default: {
                errorAndWarningList.errorList.push(
                  `Error: ${
                    panelData?.title ??
                    panelData?.embeddableConfig?.attributes?.title ??
                    panelData?.attributes?.title
                  } -> unsupported panel conversion (skipping)`
                );
                break;
              }
            }
            break;
          }
          default: {
            errorAndWarningList.errorList.push(
              `Error: ${
                panelData?.title ??
                panelData?.embeddableConfig?.attributes?.title ??
                panelData?.attributes?.title
              } unsupported panel conversion (skipping)`
            );
          }
        }
      });
    } else {
      errorAndWarningList.errorList.push(
        "Error: No object fount with type dashboard"
      );
    }
  } catch (error) {
    console.log(error);
  } finally {
    return { dashboard: o2Dashboard, errorAndWarningList };
  }
};
