import { getDefaultDashboardPanelData, sqlchart } from "../commons/common";
import type { O2Dashboard } from "../schema/openobserve";

const kibanaToO2ChartType: any = {
  lnsMetric: "metric",
  table: "table",
  bar_horizontal: "h-bar",
  bar_horizontal_percentage: "h-stacked",
  bar_horizontal_stacked: "h-stacked",
  bar: "bar",
  bar_stacked: "stacked",
  bar_stacked_percentage: "stacked",
  area: "area",
  area_stacked: "area-stacked",
  area_stacked_percentage: "area-stacked",
  line: "line",
  donut: "donut",
  lnsPie: "pie",
  gauge: "gauge",
  heatmap: "heatmap",
};

const kibanaToO2AggregationFunction: any = {
  count: "count",
  unique_count: "count-distinct",
  sum: "sum",
  avg: "avg",
  min: "min",
  max: "max",
};

export const convertKibanaToO2 = (kibanaJSON: any) => {
  const O2Dashboard: O2Dashboard = {
    title: "",
    // NOTE: the dashboard ID is generated at the server side,
    // in "Create a dashboard" request handler. The server
    // doesn't care what value we put here as long as it's
    // a string.
    dashboardId: "",
    description: "",
    variables: {
      list: [],
      showDynamicFilters: true,
    },
    role: "",
    created: new Date().toISOString(),
    tabs: [
      {
        panels: [],
        name: "Default",
        tabId: "default",
      },
    ],
    version: 3,
  };
  try {
    // find object with type dashboard
    const kibanaDashboard = kibanaJSON.find((obj: any) => {
      return obj.type === "dashboard";
    });

    // also, there will be object with type index-pattern
    // get all index pattern and make one object with key as index pattern id and value as index pattern name
    const kibanaIndexPatterns = kibanaJSON.filter((obj: any) => {
      return obj.type === "index-pattern";
    });

    const indexPatternMap: any = {};
    kibanaIndexPatterns.forEach((kibanaIndexPattern: any) => {
      indexPatternMap[kibanaIndexPattern.id] =
        kibanaIndexPattern.attributes.title;
    });

    // convert dashboard
    if (kibanaDashboard) {
      O2Dashboard.title = kibanaDashboard.attributes.title;
      O2Dashboard.description = kibanaDashboard.attributes.description;

      // panels is in stringified json
      // convert it into object
      kibanaDashboard.attributes.panelsJSON = JSON.parse(
        kibanaDashboard.attributes.panelsJSON
      );

      console.log(kibanaDashboard);

      // loop on all panels
      // and push each panel into O2Dashboard
      kibanaDashboard.attributes.panelsJSON.forEach(
        (panel: any, panelIndex: number) => {
          const panelData = getDefaultDashboardPanelData();

          // set panel title
          panelData.title = panel.title ?? "Panel " + (panelIndex + 1);

          // currently, support for only lens type
          // ignore map, canvas and other types
          if (panel.type == "lens") {
            // take first query type
            // openobserve only support one type per chart
            const kibanaChartType: any =
              panel?.embeddableConfig?.attributes?.state?.visualization
                ?.preferredSeriesType ??
              panel?.embeddableConfig?.attributes?.visualizationType ??
              "bar";

            panelData.type = kibanaToO2ChartType[kibanaChartType] ?? "bar";
            // if kibana chart type is pie chart, check shape is donut
            if (panelData.type == "pie") {
              panelData.type =
                panel?.embeddableConfig?.attributes?.state?.visualization
                  ?.shape == "donut"
                  ? "donut"
                  : "pie";
            }

            // check for show legend option
            panelData.config.show_legends =
              panel?.embeddableConfig?.attributes?.state?.visualization?.legend
                ?.isVisible ?? true;

            // check for legend position
            // openobserve only supports right and bottom
            panelData.config.legends_position =
              panel?.embeddableConfig?.attributes?.state?.visualization?.legend
                ?.position === "right"
                ? "right"
                : "bottom";

            // set x, y axis
            // find first layer who has type as a data
            const firstDataLayer =
              panel?.embeddableConfig?.attributes?.state?.visualization?.layers?.find(
                (layer: any) => {
                  return layer?.layerType === "data";
                }
              ) ?? null;

            const kibanaColumns =
              panel?.embeddableConfig?.attributes?.state?.datasourceStates
                ?.indexpattern?.layers[firstDataLayer?.layerId]?.columns ?? [];

            console.log(kibanaColumns, "kibanaColumns");

            const xAccessor =
              firstDataLayer?.xAccessor ?? firstDataLayer?.metric ?? null;
            const splitAccessor = firstDataLayer?.splitAccessor ?? null;

            if (xAccessor) {
              // add into x axis
              // NOTE: for timestamp field histogram function is pending
              panelData.queries[0].fields.x.push({
                label: kibanaColumns[xAccessor].label,
                alias: "x_axis_" + (panelData.queries[0].fields.x.length + 1),
                column: kibanaColumns[xAccessor].sourceField.replace(
                  /\./g,
                  "_"
                ),
                sort_by: "ASC",
              });
            }

            if (splitAccessor) {
              // add into x axis as 2nd field
              panelData.queries[0].fields.x.push({
                label: kibanaColumns[splitAccessor].label,
                alias: "x_axis_" + (panelData.queries[0].fields.x.length + 1),
                column: kibanaColumns[splitAccessor].sourceField.replace(
                  /\./g,
                  "_"
                ),
                sort_by: "ASC",
              });
            }

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
                  label: kibanaColumns[columnId].label,
                  alias: "y_axis_" + (panelData.queries[0].fields.y.length + 1),
                  column: kibanaColumns[columnId].sourceField.replace(
                    /\./g,
                    "_"
                  ),
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
              panel?.embeddableConfig?.attributes?.references?.find(
                (ref: any) => {
                  return (
                    ref.type === "index-pattern" &&
                    ref.name ===
                      `indexpattern-datasource-layer-${firstDataLayer?.layerId}`
                  );
                }
              )?.id ?? null;
            panelData.queries[0].fields.stream =
              indexPatternMap[indexPatternId] ?? "";

            // take unit from first vertical axis
            // default || number   ->    default
            // percent             ->    percent(0-100)
            // bytes(1024)         ->    bytes

            // set layout
            panelData.layout = {
              x: panel.gridData.x,
              y: panel.gridData.y,
              w: panel.gridData.w,
              h: Math.max(3, panel.gridData.h - 3),
              i: panelIndex,
            };

            // make query based on fields and stream
            panelData.queries[0].query = sqlchart(panelData, 0);

            // push panel into O2Dashboard
            O2Dashboard.tabs[0].panels.push(panelData);
          }
        }
      );
    }
  } catch (error) {
    console.log(error);
  } finally {
    return O2Dashboard;
  }
};
