import type { Panel } from "../schema/openobserve";

export const generatePanelId = () => {
  return "Panel_ID" + Math.floor(Math.random() * (99999 - 10 + 1)) + 10;
};

export const getInitialDashboardData = () => {
  return {
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
};

export const getDefaultDashboardPanelData: any = () => ({
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

export const sqlchart = (panelData: any, queryIndex: number = 0) => {
  // STEP 1: first check if there is at least 1 field selected
  if (
    panelData.queries[queryIndex].fields.x.length == 0 &&
    panelData.queries[queryIndex].fields.y.length == 0 &&
    panelData.queries[queryIndex].fields.z.length == 0
  ) {
    panelData.queries[queryIndex].query = "";
    return;
  }

  // STEP 2: Now, continue if we have at least 1 field selected
  // merge the fields list
  let query = "SELECT ";
  const fields = [
    ...panelData.queries[queryIndex].fields.x,
    ...panelData.queries[queryIndex].fields.y,
    ...(panelData?.queries[queryIndex].fields?.z
      ? [...panelData.queries[queryIndex].fields.z]
      : []),
  ].flat();
  const filter = [...panelData.queries[queryIndex].fields?.filter];
  const array = fields.map((field, i) => {
    let selector = "";

    // TODO: add aggregator
    if (field?.aggregationFunction) {
      switch (field?.aggregationFunction) {
        case "count-distinct":
          selector += `count(distinct(${field?.column}))`;
          break;
        case "histogram": {
          // if inteval is not null, then use it
          if (field?.args && field?.args?.length && field?.args[0].value) {
            selector += `${field?.aggregationFunction}(${field?.column}, '${field?.args[0]?.value}')`;
          } else {
            selector += `${field?.aggregationFunction}(${field?.column})`;
          }
          break;
        }
        default:
          selector += `${field?.aggregationFunction}(${field?.column})`;
          break;
      }
    } else {
      selector += `${field?.column}`;
    }
    selector += ` as "${field?.alias}"${i == fields.length - 1 ? " " : ", "}`;
    return selector;
  });
  query += array?.join("");

  // now add from stream name
  query += ` FROM "${panelData.queries[queryIndex].fields?.stream}" `;

  const filterData = filter?.map((field, i) => {
    let selectFilter = "";
    if (field.type == "list" && field.values?.length > 0) {
      selectFilter += `${field.column} IN (${field.values
        .map((it) => `'${it}'`)
        .join(", ")})`;
    } else if (field.type == "condition" && field.operator != null) {
      selectFilter += `${field?.column} `;
      if (["Is Null", "Is Not Null"].includes(field.operator)) {
        switch (field?.operator) {
          case "Is Null":
            selectFilter += `IS NULL`;
            break;
          case "Is Not Null":
            selectFilter += `IS NOT NULL`;
            break;
        }
      } else if (field.value != null && field.value != "") {
        switch (field.operator) {
          case "=":
          case "<>":
          case "<":
          case ">":
          case "<=":
          case ">=":
            selectFilter += `${field?.operator} ${field?.value}`;
            break;
          case "Contains":
            selectFilter += `LIKE '%${field.value}%'`;
            break;
          case "Not Contains":
            selectFilter += `NOT LIKE '%${field.value}%'`;
            break;
          default:
            selectFilter += `${field.operator} ${field.value}`;
            break;
        }
      }
    }
    return selectFilter;
  });

  const filterItems = filterData.filter((it: any) => it);
  if (filterItems.length > 0) {
    query += "WHERE " + filterItems.join(" AND ");
  }

  // add group by statement
  const xAxisAlias = panelData.queries[queryIndex].fields.x.map(
    (it: any) => it?.alias
  );
  const yAxisAlias = panelData.queries[queryIndex].fields.y.map(
    (it: any) => it?.alias
  );

  if (panelData.type == "heatmap") {
    query +=
      xAxisAlias.length && yAxisAlias.length
        ? " GROUP BY " + xAxisAlias.join(", ") + ", " + yAxisAlias.join(", ")
        : "";
  } else {
    query += xAxisAlias.length ? " GROUP BY " + xAxisAlias.join(", ") : "";
  }

  // array of sorting fields with followed by asc or desc
  const orderByArr = [];

  fields.forEach((it: any) => {
    // ignore if None is selected or sortBy is not there
    if (it?.sortBy) {
      orderByArr.push(`${it?.alias} ${it?.sortBy}`);
    }
  });

  // append with query by joining array with comma
  query += orderByArr.length ? " ORDER BY " + orderByArr.join(", ") : "";

  // append limit
  // if limit is less than or equal to 0 then don't add
  const queryLimit = panelData.queries[queryIndex].config.limit ?? 0;
  query += queryLimit > 0 ? " LIMIT " + queryLimit : "";

  return query;
};
