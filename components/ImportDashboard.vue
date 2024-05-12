for error message and warning also want overyflow-y auto with 15 rows
<template>
  <div class="q-mx-md q-my-md flex flex-row">
    <!-- Left Side: Imports -->
    <div class="q-mr-md flex:1" style="width: 400px">
      <!-- File Import Section -->
      <q-separator class="q-my-sm" />
      <q-form @submit.prevent="handleFileUpload">
        <div class="q-my-md">Import Dashboard from exported JSON file</div>
        <div style="width: 400px">
          <!-- File Input -->
          <q-file
            filled
            bottom-slots
            v-model="file"
            label="Drop JSON file here"
            accept=".json, .ndjson"
            multiple
          >
            <template v-slot:prepend>
              <q-icon name="cloud_upload" />
            </template>
            <template v-slot:append>
              <q-icon
                name="close"
                class="cursor-pointer"
                @click="file = null"
              />
            </template>
            <template v-slot:hint>.json or .ndjson files only</template>
          </q-file>

          <!-- Import Button -->
          <q-btn
            label="Import"
            color="secondary"
            class="q-my-md text-bold no-border"
            padding="sm xl"
            type="submit"
            no-caps
            @click="handleFileUpload"
          />
        </div>
      </q-form>

      <!-- URL Import Section -->
      <q-separator class="q-my-sm" />
      <q-form @submit.prevent="handleURLImport">
        <div class="q-my-md">Import Dashboard from URL</div>
        <div style="width: 400px">
          <!-- URL Input -->
          <q-input
            v-model="url"
            label="Enter URL"
            filled
            dense
            color="secondary"
            :disable="isLoading"
          />

          <!-- Import Button -->
          <q-btn
            label="Import"
            color="secondary"
            class="q-my-md text-bold no-border"
            padding="sm xl"
            type="submit"
            no-caps
            @click="handleURLImport"
          />
        </div>
      </q-form>

      <!-- JSON String Import Section -->
      <q-separator class="q-my-sm" />
      <q-form @submit.prevent="handleNDJSONPaste">
        <div class="q-my-md">Import Dashboard from JSON string</div>
        <div style="width: 400px">
          <!-- JSON Input -->
          <q-input
            v-model="ndjson"
            label="Enter JSON string"
            filled
            dense
            type="textarea"
            color="secondary"
            :disable="isLoading"
          />

          <!-- Import Button -->
          <q-btn
            label="Import"
            color="secondary"
            class="q-my-md text-bold no-border"
            padding="sm xl"
            type="submit"
            no-caps
            @click="handleNDJSONPaste"
          />
        </div>
      </q-form>
    </div>

    <div class="flex:1 q-ml-lg">
      <div class="q-mx-md q-my-md">
        <div>
          <div v-if="conversionErrors.length">
            <h5>Errors</h5>
            <div v-for="error in conversionErrors" :key="error">
              <q-banner inline-actions rounded class="bg-red text-white">{{
                error
              }}</q-banner>
            </div>
          </div>
          <div v-if="conversionWarnings.length">
            <h5>Warnings</h5>
            <div v-for="warning in conversionWarnings" :key="warning">
              <q-banner inline-actions rounded class="bg-yellow text-white">{{
                warning
              }}</q-banner>
            </div>
          </div>
        </div>

        <div
          class="q-my-md"
          style="max-height: 20em; overflow-y: auto; width: 400px"
        >
          <div style="position: sticky; top: 0; background-color: white">
            <h5>Converted Dashboard</h5>
          </div>
          <pre>{{ o2json || "No content available" }}</pre>
        </div>

        <div class="q-mx-md">
          <q-btn
            label="Download JSON"
            color="secondary"
            @click="downloadO2JSON"
            class="q-my-md text-bold no-border"
            padding="sm xl"
            no-caps
          />
          <q-btn
            label="Copy to Clipboard"
            color="secondary"
            @click="copyToClipboard"
            class="q-my-md q-ml-sm text-bold no-border"
            padding="sm xl"
            no-caps
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { convertKibanaToO2 } from "~/lib";

export default {
  name: "ImportDashboard",
  setup() {
    const file = ref(null);
    const url = ref("");
    const ndjson = ref("");
    const isLoading = ref(false);
    const fileImportResults = ref([]);
    const o2json = ref(null);
    const conversionWarnings = ref([]);
    const conversionErrors = ref([]);

    const handleFileUpload = (event) => {
      // get first file
      file.value = event.target.files[0];

      // handle file import here
      // Create a new FileReader instance
      let reader = new FileReader();

      // on file load
      reader.onload = (e) => {
        // Try to parse the file as NDJSON
        let lines = e.target.result.split("\n");
        let jsonArray = [];
        try {
          lines.forEach((line) => {
            if (line) jsonArray.push(JSON.parse(line));
          });
          // params
          // jsonArray
          // timestampField
          // default stream name
          const o2ConversionRes = convertKibanaToO2(
            jsonArray,
            "_timestamp",
            "es2"
          );
          o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
          conversionErrors.value =
            o2ConversionRes.errorAndWarningList.errorList;
          conversionWarnings.value =
            o2ConversionRes.errorAndWarningList.warningList;
        } catch (error) {
          // not able to parse json
          // ie. not NDJSON
          conversionErrors.value = ["Error:" + JSON.stringify(error)];
        }
      };

      // Read the file as text
      reader.readAsText(file.value);
    };

    const handleURLImport = () => {
      // handle URL import here, using url.value
      try {
        fetch(url.value)
          .then((response) => response.text()) // Get the response text
          .then((text) => {
            // Try to parse the file as NDJSON
            let lines = text.split("\n");
            let jsonArray = [];
            lines.forEach((line) => {
              if (line) jsonArray.push(JSON.parse(line));
            });
            const o2ConversionRes = convertKibanaToO2(
              jsonArray,
              "_timestamp",
              "es2"
            );
            o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
            conversionErrors.value =
              o2ConversionRes.errorAndWarningList.errorList;
            conversionWarnings.value =
              o2ConversionRes.errorAndWarningList.warningList;
          });
      } catch (error) {
        // not able to parse json
        // ie. not NDJSON
        // console.log("error while fetching", error);
        conversionErrors.value = ["Error:" + JSON.stringify(error)];
      }
    };

    const handleNDJSONPaste = () => {
      // handle NDJSON paste here, using ndjson.value
      // Try to parse the file as NDJSON
      let lines = ndjson.value.split("\n");
      let jsonArray = [];
      try {
        lines.forEach((line) => {
          if (line) jsonArray.push(JSON.parse(line));
        });
        const o2ConversionRes = convertKibanaToO2(
          jsonArray,
          "_timestamp",
          "es2"
        );
        o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
        conversionErrors.value = o2ConversionRes.errorAndWarningList.errorList;
        conversionWarnings.value =
          o2ConversionRes.errorAndWarningList.warningList;
      } catch (error) {
        // not able to parse json
        // ie. not NDJSON
        // console.log("The file is not NDJSON", error);
        conversionErrors.value = ["Error:" + JSON.stringify(error)];
      }
    };

    const downloadO2JSON = () => {
      // download o2json.value
      // prepare json and download via a click
      const data =
        "data:text/json;charset=utf-8," + encodeURIComponent(o2json.value);
      const htmlA = document.createElement("a");
      htmlA.setAttribute("href", data);
      const fileName = "O2_Dashboard";
      htmlA.setAttribute("download", fileName + ".json");
      htmlA.click();
    };

    const copyToClipboard = () => {
      navigator.clipboard.writeText(o2json.value);
    };

    return {
      file,
      url,
      ndjson,
      isLoading,
      fileImportResults,
      o2json,
      handleFileUpload,
      handleURLImport,
      handleNDJSONPaste,
      downloadO2JSON,
      copyToClipboard,
      conversionWarnings,
      conversionErrors,
    };
  },
};
</script>

<style scoped></style>
