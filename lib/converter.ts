import type { O2Dashboard, Panel } from "./schema/openobserve";

const generatePanelId = () => {
  return "Panel_ID" + Math.floor(Math.random() * (99999 - 10 + 1)) + 10;
};

const kibanaToO2ChartType: any = {
  metric: "metric",
  table: "table",
  bar_horizontal: "h-bar",
  bar_horizontal_percentage: "h-stacked",
  bar_horizontal_stacked: "h-stacked",
  bar: "bar",
  bar_stacked: "stacked-bar",
  bar_stacked_percentage: "stacked-bar",
  area: "area",
  area_stacked: "stacked-area",
  area_stacked_percentage: "stacked-area",
  line: "line",
  donut: "donut",
  pie: "pie",
  gauge: "gauge",
  heatmap: "heatmap",
};

const getDefaultDashboardPanelData: Panel = () => ({
  id: generatePanelId(),
  type: "bar",
  title: "",
  description: "",
  config: {
    show_legends: true,
    legends_position: null,
    unit: null,
    unit_custom: null,
    decimals: 2,
    axis_width: null,
    axis_border_show: false,
    legend_width: {
      value: null,
      unit: "px",
    },
    base_map: {
      type: "osm",
    },
    map_view: {
      zoom: 1,
      lat: 0,
      lng: 0,
    },
    map_symbol_style: {
      size: "by Value",
      size_by_value: {
        min: 1,
        max: 100,
      },
      size_fixed: 2,
    },
    drilldown: [],
    connect_nulls: false,
    wrap_table_cells: false,
  },
  queryType: "sql",
  queries: [
    {
      query: "",
      customQuery: false,
      fields: {
        stream: "",
        stream_type: "logs",
        x: [],
        y: [],
        z: [],
        filter: [],
        latitude: null,
        longitude: null,
        weight: null,
        source: null,
        target: null,
        value: null,
      },
      config: {
        promql_legend: "",
        layer_type: "scatter",
        weight_fixed: 1,
        limit: 0,
        // gauge min and max values
        min: 0,
        max: 100,
      },
    },
  ],
  layout: {
    x: 0,
    y: 0,
    w: 24,
    h: 9,
    i: 0,
  },
  htmlContent: "",
  markdownContent: "",
});

export const convertKibanaToO2 = (kibanaJSON: any) => {
  try {
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

    // find object with type dashboard
    const kibanaDashboard = kibanaJSON.find((obj: any) => {
      return obj.type === "dashboard";
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

      // loop on all panels
      // and push each panel into O2Dashboard
      console.log(kibanaDashboard);

      kibanaDashboard.attributes.panelsJSON.forEach((panel: any) => {
        const panelData = getDefaultDashboardPanelData();

        // set panel title
        panelData.title = panel.title;

        // currently, support for only lens type
        // ignore map, canvas and other types
        if (panel.type == "lens") {
          // take first query type
          // openobserve only support one type per chart
          const kibanaChartType: any =
            panel?.embeddableConfig?.attributes?.state?.visualization
              ?.preferredSeriesType ?? "bar";
          panelData.type = kibanaToO2ChartType[kibanaChartType] ?? "bar";

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

          // push panel into O2Dashboard
          O2Dashboard.tabs[0].panels.push(panelData);
        }
      });

      console.log(O2Dashboard);

      // console.log("kibana dashbaord", kibanaDashboard);
    }
  } catch (error) {
    console.log(error);
  }
};
