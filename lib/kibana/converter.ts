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

const getKibanaChartType = (panelData: any) => {
  // first, check if there is a preferred chart type
  // else if check if there is a visualization type
  // else default to bar
  if (
    panelData?.embeddableConfig?.attributes?.state?.visualization
      ?.preferredSeriesType
  ) {
    return (
      kibanaToO2ChartType[
        panelData?.embeddableConfig?.attributes?.state?.visualization
          ?.preferredSeriesType
      ] ?? "bar"
    );
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
  } else {
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

const extractKibanaData = (kibanaJSON: any) => {
  const kibanaData: any = {
    dashboard: [],
    index_pattern: [],
    indexPatternMap: {},
    panels: [],
  };

  kibanaJSON.forEach((kibana: any) => {
    switch (kibana.type) {
      case "dashboard": {
        // panelsJSON will be in stringify format, so we need to parse it
        kibana.attributes.panelsJSON = JSON.parse(
          kibana.attributes.panelsJSON ?? "[]"
        );
        kibanaData.dashboard.push(kibana);

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
        // ignore search, map and others types
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

const getFirstLayer = (panel: any) => {
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
  kibanaData: any
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
        const firstDataLayer = getFirstLayer(panel);

        // set x, y axis
        // find first layer who has type as a data
        const kibanaColumns =
          panel?.embeddableConfig?.attributes?.state?.datasourceStates
            ?.indexpattern?.layers[firstDataLayer?.layerId]?.columns ?? [];

        const xAccessor =
          firstDataLayer?.xAccessor ?? firstDataLayer?.metric ?? null;
        const splitAccessor = firstDataLayer?.splitAccessor ?? null;

        if (xAccessor) {
          // add into x axis
          // NOTE: for timestamp field histogram function is pending
          panelData.queries[0].fields.x.push({
            label: kibanaColumns[xAccessor].label,
            alias: "x_axis_" + (panelData.queries[0].fields.x.length + 1),
            column: kibanaColumns[xAccessor].sourceField.replace(/\./g, "_"),
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
              column: kibanaColumns[columnId].sourceField.replace(/\./g, "_"),
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
      const accessor =
        panel?.embeddableConfig?.attributes.state.visualization.accessor;

      const columnData =
        panel?.embeddableConfig?.attributes.state.datasourceStates.indexpattern
          .layers[layerId].columns[accessor];

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
    case "gauge":
    case "heatmap":
    case "table": {
      break;
    }
    default:
      break;
  }
};

export const convertKibanaToO2 = (kibanaJSON: any) => {
  const O2Dashboard: O2Dashboard = getInitialDashboardData();
  try {
    const kibanaData = extractKibanaData(kibanaJSON);

    // convert dashboard
    if (kibanaData.dashboard.length > 0) {
      O2Dashboard.title = kibanaData.dashboard[0].attributes.title;
      O2Dashboard.description = kibanaData.dashboard[0].attributes.description;

      // loop on all panels
      // and push each panel into O2Dashboard
      kibanaData.panels.forEach((panel: any, panelIndex: number) => {
        const panelData = getDefaultDashboardPanelData();

        // set panel title
        // if title is not set, set default title as Panel [index]
        panelData.title =
          panel?.title ??
          panel?.attributes?.title ??
          "Panel " + (panelIndex + 1);

        switch (panel.type) {
          // currently, support for only lens type
          // ignore map, canvas, controls and other types
          case "lens": {
            // take first query type
            // openobserve only support one type per chart

            panelData.type = getKibanaChartType(panel) ?? "bar";

            // set legend config
            // show_legends
            // legends_position
            setLegendConfig(panel, panelData);

            // set fields based on panel type
            setFieldsBasedOnPanelType(panel, panelData, kibanaData);

            // take unit from first vertical axis
            // default || number   ->    default
            // percent             ->    percent(0-100)
            // bytes(1024)         ->    bytes

            // set layout
            panelData.layout = {
              x: panel?.gridData?.x ?? 0,
              y: panel?.gridData?.y ?? 0,
              w: panel?.gridData?.w ?? 24,
              h: Math.max(3, panel?.gridData?.h ?? 9 - 3),
              i: panelIndex,
            };

            // make query based on fields and stream
            panelData.queries[0].query = sqlchart(panelData, 0);

            // push panel into O2Dashboard
            O2Dashboard.tabs[0].panels.push(panelData);
          }
        }
      });
    }
  } catch (error) {
    console.log(error);
  } finally {
    return O2Dashboard;
  }
};
