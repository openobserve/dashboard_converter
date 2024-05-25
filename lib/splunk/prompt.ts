import OpenAI from "openai";

export const systemPrompt = `You are an expert in writing and converting SPL and SQL query languages. Your role is to help user convert SPL query to SQL query based on his requirement. You should make sure that the answers you provide are properly analyzed and tested. And you should only provide answers in the format user has requested. MAKE SURE THAT THE ANSWER IS IN THE FORMAT USER HAS REQUESTED. DO NOT ADD ANY OTHER TEXT AND DO NOT USE MARKDOWN`;

export const queryPrompt = `
I want to convert SPL(Search Processing Language) query to SQL query based on my requirements. 

Make sure all of my below requirements must be fulfilled in your converted SQL:

1. Regarding timechart and timestamp

In SPL, if the query has \`timechart\`, then use the time field as \`histogram(_timestamp)\`. 
Also, span value will be used as 2nd parameter of histogram aggregation field.
For example \`timechart span=5m \` will be converted as \`histogram(_timestamp, '5 minute')\`. The interval values supported in our SQL are second, minute, hour, day, week. Convert to our supported interval if required and we do not have any equivalent value. Same for other span values. For example, \`1s\` will be replaced with \`1 seconds\`.
Also, for timechart ignore date format. This should go in the x-axis

For eg histogram(_timestamp) as x_axis_1

Make sure that it is not required ignore if it is not timeseries chart.

2. \`by\` clause conversion

In SPL, there will be fields with \`by\` clauses that need to be used in the x axis.

Here is how you should convert it.
SPL: index="sales" | timechart span=1d sum(price) by productId 

Above SPL query should be converted as follows:

SQL: SELECT histogram(_timestamp, '1 day') as “x_axis_1”, productId as "x_axis_2", sum(price) as "y_axis_1" FROM sales GROUP BY x_axis_1, x_axis_2 ORDER BY x_axis_1 ASC, x_axis_2 ASC

3. Regarding Aggregation function
- In SQL, We only support below list of aggregation function:
  1) count
  2) count-distinct
  3) histogram
  4) sum
  5) min
  6) max
  7) avg

- For count-distinct, for example if field name is \`name\` then \`count-distinct(name)\` will be converted as \`count(distinct(name))\`.

- So, While query conversion, you must use only supported aggregation functions. if SPL query uses other aggregation functions, replace that aggregation function with \`count\` aggregation function in SQL query. Also, add warning in the warning list that \`<used aggregation function> is not supported. using count as a default\`. You should never use anything else than the above 7 supported aggregation functions. For an example, if anyone has used first, or any other aggregation functions you should replace it with \`count\`.

4. How to use alias, groupby and orderby

All fields including timestamp and other fields which are part of group by statement should be considered as x-axis fields. 

All other fields which have an aggregation function applied should be considered as y-axis fields.

For example, \`count by verb\` or \`stats count by verb\` will be converted as \`count(verb)\` and it will go into the y-axis.

After writing, the \`as\` alias should be like x_axis / y_axis.

timestamp/histogram will always go to x-axis.

For example, x-axis has 2 fields, then its alias will be x_axis_1 and x_axis_2. The same logic will be used for y-axis fields. 

Use double quotes while giving alias.

5. Group by and order by

In group by all x-axis fields will be taken. so that all aggregation functions would work.
If any sorting order is specified on any field in the SPL, then same should be added to SQL on the same field as well.

If there is _timestamp always take ASC, for all other x-axis fields take a given order from SPL query, if not provided use ASC by default.

In group by and order by always use the alias names do not use any quotes.

Please make sure that you do not use any quotes while using aliases in group by and order by only.

6. How to choose table name

In SPL, \`index\` is similar to table names in SQL. So, use an index name with \`from\` in SQL. Also add double quotes before and after table name as in our SQL syntax, we only allow table names to be written between double quotes.

7. conditions with Where clause

All conditions will be used with the where clause of SQL.

8. Variables
In SPL you may find some variables like $variable_name$ . But in our SQL we refer to variables as '$variable_name' (with only preceding $ symbol and use single quotes).

For example, The SPL variables \`\`\` $host$ \`\`\` and \`\`\` $error_code$ \`\`\` are replaced with \`\`\` '$host' \`\`\` and \`\`\` '$error_code' \`\`\`, respectively, in the SQL query.

9. limit and offset

convert head, limit and offset to SQL by using \`limit\` clause and \`offset\` clause.
Also, if any fields is used with limit or head or offset, then it should be added in the x axis while converting to SQL.


Here is how you should convert it.
SPL: index="sales" | timechart span=1d sum(price) | limit 15 cluster_id 

Above SPL query should be converted as follows:

SQL: SELECT histogram(_timestamp, '1 day') as “x_axis_1”, cluster_id as "x_axis_2", sum(price) as "y_axis_1" FROM sales GROUP BY x_axis_1, x_axis_2 ORDER BY x_axis_1 ASC, x_axis_2 ASC limit 15



10. Special conditions
- Do not use Case clause of SQL wherever possible
- use COALESCE function wherever needed
- ignore eval and eval fields while conversion to SQL.
- replace \`count(*)\` clause with \`count(_timestamp)\`.(add warning that: "using count(_timestamp) instead of count(*)")
- Ignore rex and rex fields while conversion to SQL.( continue converting the query. but just add warning that: "rex and rex fields are ignored in SQL" in the \`warningAndErrorList\` which is returned in the response with status as success.)

11. Dot notations for field names
- We do not support dot notation in our SQL, so in all field names, replace all \`.\`(dot) with \`_\`(underscore)
- append "event_" as prefix for each filed name except \`_timestamp\` field.
- For an example: \`obj.name\` should be replaced with \`obj_name\` and will be appended as \`event_obj_name\`


By considering all above requirements/rules, give me a converted SQL query of below query.

\`\`\`
%%QUERYPLACEHOLDER%%
\`\`\`
YOU MUST USE ABOVE 9 RULES WHILE CONVERTING. DO NOT FORGOT SINGLE RULE..........................

The response should be in the \`json\` format only based on the below structure:
\`\`\`
{
    status: "success", // or "error" if converting to SQL is not possible
    message: "" // any warnings / error from your conversion
    query: "<your converted SQL query here>",
    originalQuery: "<original SPL query here>",
   warningAndErrorList: {
      warnings:[<List of warnings which is defined in rule>],
      errors:[<List of errors which is defined in rule>]
   },
    "fields": {
                "stream": "<table name (from index)>", // this is what you get in the query part "from <table name>"
                "stream_type": "logs", // this will always be "logs"
                "x": [  // all the fields that are considered in x-axis
                  {
                    "label": "Timestamp", // field name by replacing . or _ with space
                    "alias": "x_axis_1",
                    "column": "x_axis_1", // same as alias
                    "color": null,
                    "aggregationFunction": "histogram", // if it is timeseries field else set it to null for x axis fields
                  }
                ],
                "y": [ // all the fields that are considered in y-axis
                {
                  "label": "Pod name", // field name by replacing . or _ with space
                  "alias": "y_axis_1",
                  "column": "y_axis_1", // same as alias
                  "color": null,
                  "aggregationFunction": "count" // aggregation function which is used with the field, y axis must uses aggregation function. this functions should only be from the list of aggregations functions we provided in the list. anything outside of that list should use count and add warning
                  }
                ],
                "z": [], // this will always be blank
                "filter": [] // this will always be blank
              },
}

\`\`\`
Be concise and omit disclaimers.
Skip introduction and conclusion, start with the main point.
Output answers without any introductory or conclusion text.
Don't justify your answers
While being concise and without commentary, return me the json and nothing else. 
IF you are good person, ONLY AND ONLY RETURN JSON IN YOUR RESPONSE (NOT EVEN MARKDOWN), NOTHING ELSE. I REPEAT, NOTHING ELSE, ONLY JSON. 

`;

export const variableQueryPrompt = `
I want to extract data from given SPL query. 
data will be like selected field, table/index/data source name, where condition extraction.
Make sure all of my below requirements must be fulfilled while extraction:

1. Stream name extraction
extract table/ index/ data source/ stream name from SPL query.

2. extract single field
in most cases, SPL query will have single selected field. if multiple found take any one field.

3. where clause/ conditions:
- make sure to use valid conditions from query. ignore fillnull, fillzero, etc. only use valid conditions like equality, not equality, IN operator only.
- make an array of object. where each object will have field name, operator and its value.
- only "=", "!=", "IN" operator will be allowed. ignore if other found.
- for value, if it uses any other variable then follow variables rule which is mentioned in prompt.
- do not use single or double quote in value.

4. Variables
In SPL you may find some variables like $variable_name$ . But in our value of where clause we refer to variables as $variable_name (with only preceding $ symbol and without any quotes).

For example, The SPL variables \`\`\` $host$ \`\`\` and \`\`\` $error_code$ \`\`\` are replaced with \`\`\` $host \`\`\` and \`\`\` $error_code \`\`\`, respectively, in the value of the where clause.

5. limit and offset

convert head, limit and offset to SQL by using \`limit\` clause and \`offset\` clause.

6. Special conditions
- Do not use Case clause of SQL wherever possible
- use COALESCE function wherever needed
- replace \`count(*)\` clause with \`count(_timestamp)\`.(add warning that: "using count(_timestamp) instead of count(*)")
- Ignore rex and rex fields while conversion to SQL.( continue converting the query. but just add warning that: "rex and rex fields are ignored in SQL" in the \`warningAndErrorList\` which is returned in the response with status as success.)

7. Dot notations for field names
- We do not support dot notation in our SQL, so in all field names, replace all \`.\`(dot) with \`_\`(underscore)
- append "event_" as prefix for each filed name except [_timestamp] fields.
- For an example: \`obj.name\` should be replaced with \`obj_name\` and will be appended as \`event_obj_name\`

By considering all above requirements/rules, give me a converted SQL query of below query.

\`\`\`
%%QUERYPLACEHOLDER%%
\`\`\`
YOU MUST USE ABOVE 5 RULES WHILE CONVERTING. DO NOT FORGOT SINGLE RULE..........................

The response should be in the \`json\` format only based on the below structure:
\`\`\`
{
    status: "success", // or "error" if converting to SQL is not possible
    message: "" // any warnings / error from your conversion
    originalQuery: "<original SPL query here>",
   warningAndErrorList: {
      warnings:[<List of warnings which is defined in rule>],
      errors:[<List of errors which is defined in rule>]
   },
    "query_data": {
          "stream_type": "logs", <always use logs>
          "stream": "default", "<table name (from index)>", // this is what you get in the query part "from <table name>"
          "field": "k8s_pod_name", <field name> // this is what you get in the the query part "select <field name>". make sure to use actual field name do not use alias.
          "max_record_size": null || <query limit>, //this is what you get in the query part "limit <query limit>". take "null" if not exists
          "filter": [
            {
              "name": "k8s_namespace_name",
              "operator": "=",
              "value": "$k8s_namespace_name"
            },
            {
              "name": "field_2
              "operator": "!=",
              "value": "k8s"
            }
          ] // will be an array of condition. create array with field name its operator and its value. 
       },
}

\`\`\`
Be concise and omit disclaimers.
Skip introduction and conclusion, start with the main point.
Output answers without any introductory or conclusion text.
Don't justify your answers
While being concise and without commentary, return me the json and nothing else. 
IF you are good person, ONLY AND ONLY RETURN JSON IN YOUR RESPONSE (NOT EVEN MARKDOWN), NOTHING ELSE. I REPEAT, NOTHING ELSE, ONLY JSON. 

`;

export const openai = (openApi: any) => {
  const instance = new OpenAI({
    apiKey: openApi,
    dangerouslyAllowBrowser: true,
  });
  return instance;
};
