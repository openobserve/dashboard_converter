enum StreamType {
  Logs = "logs",
  Metrics = "metrics",
  Traces = "traces",
  EnrichmentTables = "enrichment_tables",
  Filelist = "file_list",
  Metadata = "metadata",
  Index = "index",
}

export interface O2Dashboard {
  version: number;
  dashboardId?: string;
  title: string;
  description: string;
  role?: string;
  owner?: string;
  created?: String;
  tabs?: Tab[];
  variables?: Variables | null;
}

interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
  i: number;
}

interface Tab {
  tabId: string;
  name: string;
  panels?: Panel[];
}

export interface Panel {
  id: string;
  type: string;
  title: string;
  description: string;
  // config: PanelConfig;
  queryType?: string;
  queries: Query[];
  layout: Layout;
  htmlContent?: string | null;
  markdownContent?: string | null;
}

interface Query {
  query?: string | null;
  customQuery: boolean;
  fields: PanelFields;
  config: QueryConfig;
}

interface PanelFields {
  stream: string;
  stream_type: StreamType;
  x: AxisItem[];
  y: AxisItem[];
  z?: AxisItem[] | null;
  latitude?: AxisItem | null;
  longitude?: AxisItem | null;
  weight?: AxisItem | null;
  source?: AxisItem | null;
  target?: AxisItem | null;
  value?: AxisItem | null;
  filter: PanelFilter[];
}

interface AxisItem {
  label: string;
  alias: string;
  column: string;
  color?: string | null;
  aggregationFunction?: AggregationFunc | null;
  sort_by?: string | null;
  args?: AxisArg[] | null;
}

interface AxisArg {
  value?: string | null;
}

enum AggregationFunc {
  Count = "count",
  CountDistinct = "count-distinct",
  Histogram = "histogram",
  Sum = "sum",
  Min = "min",
  Max = "max",
  Avg = "avg",
}

interface PanelFilter {
  type: string;
  values: string[];
  column: string;
  operator?: string | null;
  value?: string | null;
}

interface PanelConfig {
  show_legends: boolean;
  legends_position?: string | null;
  unit?: string | null;
  unit_custom?: string | null;
  decimals?: number | null;
  axis_width?: number | null;
  axis_border_show?: boolean | null;
  legend_width?: LegendWidth | null;
  base_map?: BaseMap | null;
  map_view?: MapView | null;
  map_symbol_style?: MapSymbolStyle | null;
  drilldown?: DrillDown[] | null;
  connect_nulls?: boolean | null;
  wrap_table_cells?: boolean | null;
}

interface DrillDown {
  name?: string | null;
  type?: string | null;
  target_blank?: boolean | null;
  find_by?: string | null;
  data?: DrillDownData | null;
}

interface DrillDownData {
  url?: string | null;
  folder?: string | null;
  dashboard?: string | null;
  tab?: string | null;
  pass_all_variables?: boolean | null;
  variables?: DrillDownVariables[] | null;
}

interface DrillDownVariables {
  name?: string | null;
  value?: string | null;
}

interface QueryConfig {
  promql_legend: string;
  layer_type?: string | null;
  weight_fixed?: number | null;
  limit?: number | null;
  min?: number | null;
  max?: number | null;
}

interface Variables {
  list: VariableList[];
  showDynamicFilters?: boolean | null;
}

interface VariableList {
  type: string;
  name: string;
  label: string;
  query_data?: QueryData | null;
  value?: string | null;
  options?: CustomFieldsOption[] | null;
}

interface QueryData {
  stream_type: StreamType;
  stream: string;
  field: string;
  max_record_size?: number | null;
}

interface CustomFieldsOption {
  label: string;
  value: string;
}

interface BaseMap {
  type?: string | null;
}

interface MapView {
  zoom: number;
  lat: number;
  lng: number;
}

interface MapSymbolStyle {
  size: string;
  size_by_value?: SizeByValue | null;
  size_fixed: number;
}

interface SizeByValue {
  min: number;
  max: number;
}

interface LegendWidth {
  value?: number | null;
  unit?: string | null;
}
