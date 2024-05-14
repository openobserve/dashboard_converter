<template>
  <div class="q-mx-md tw-flex tw-flex-row tw-mt-16">
    <!-- Left Side: Imports -->
    <div class="q-mr-md tw-flex:1 tw-w-1/3">
      <!-- Tabs -->
      <q-tabs v-model="activeTab" dense align="justify" class="q-my-md">
        <q-tab name="file" label="File" />
        <q-tab name="url" label="URL" />
        <q-tab name="json" label="JSON" />
      </q-tabs>

      <!-- Tab Contents -->
      <q-tab-panels v-model="activeTab">
        <!-- File Import Section -->
        <q-tab-panel name="file">
          <q-form @submit.prevent="handleFileUpload">
            <div class="q-my-md">Import Dashboard from exported JSON file</div>
            <div class="">
              <!-- File Input -->
              <q-file
                filled
                bottom-slots
                v-model="file"
                label="Drop JSON file here"
                accept=".ndjson"
                multiple
                :rules="[
                  (val) => (val && val.length > 0) || 'Please select a file',
                ]"
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
                <template v-slot:hint>.ndjson files only</template>
              </q-file>

              <!-- Import Button -->
              <q-btn
                label="Convert"
                color="secondary"
                class="q-my-md text-bold no-border"
                padding="sm xl"
                type="submit"
                no-caps
                @click="handleFileUpload"
              />
            </div>
          </q-form>
        </q-tab-panel>

        <!-- URL Import Section -->
        <q-tab-panel name="url">
          <q-form @submit.prevent="handleURLImport">
            <div class="q-my-md">Import Dashboard from URL</div>
            <div class="">
              <!-- URL Input -->
              <q-input
                v-model="url"
                label="Enter URL"
                filled
                dense
                color="secondary"
                :disable="isLoading"
                :rules="[
                  (val) => (val && val.length > 0) || 'Please enter a URL',
                ]"
              />

              <!-- Import Button -->
              <q-btn
                label="Convert"
                color="secondary"
                class="q-my-md text-bold no-border"
                padding="sm xl"
                type="submit"
                no-caps
                @click="handleURLImport"
              />
            </div>
          </q-form>
        </q-tab-panel>

        <!-- JSON String Import Section -->
        <q-tab-panel name="json">
          <q-form @submit.prevent="handleNDJSONPaste">
            <div class="q-my-md">Import Dashboard from JSON string</div>
            <div class="">
              <!-- JSON Input -->
              <q-input
                v-model="ndjson"
                label="Enter JSON string"
                filled
                dense
                type="textarea"
                color="secondary"
                :disable="isLoading"
                :rules="[
                  (val) => (val && val.length > 0) || 'Please enter JSON',
                ]"
              />

              <!-- Import Button -->
              <q-btn
                label="Convert"
                color="secondary"
                class="q-my-md text-bold no-border"
                padding="sm xl"
                type="submit"
                no-caps
                @click="handleNDJSONPaste"
              />
            </div>
          </q-form>
        </q-tab-panel>
      </q-tab-panels>
      <div>
        <div class="q-my-md q-ml-md">Config Value</div>
        <div class="q-ma-md">
          Timestamp Field:
          <q-input v-model="timestampField" class="q-mt-sm" filled dense label="Timestamp Field" />
          <q-btn
            label="Convert"
            color="secondary"
            class="q-my-md text-bold no-border"
            padding="sm xl"
            no-caps
            @click="convertTimestampField"
          />
        </div>
        <div class="q-ma-md">
          Default Stream Name:
          <q-input v-model="defaultStreamName" class="q-mt-sm" filled dense label="Default Stream Name" />
          <q-btn
            label="Convert"
            color="secondary"
            class="q-my-md text-bold no-border"
            padding="sm xl"
            no-caps
            @click="convertDefaultStreamName"
          />
        </div>
      </div>
    </div>
    <!-- Right Side -->
    <div class="tw-flex:1 q-ml-lg tw-w-2/3">
      <div class="q-mx-md q-my-md tw-h-full">
        <div
          class="q-my-md tw-overflow-y-auto"
          style="max-height: calc(100vh - 57px)"
        >
          <div v-if="conversionErrors.length">
            <div class="tw-sticky tw-top-0 tw-bg-white">
              <div>Errors</div>
            </div>
            <div v-for="error in conversionErrors" :key="error">
              <div
                style="min-height: 0px"
                inline-actions
                rounded
                class="tw-text-red-500"
              >
                {{ error }}
              </div>
            </div>
          </div>
        </div>
        <div
          class="q-my-md tw-overflow-y-auto"
          style="max-height: calc(100vh - 57px)"
        >
          <div v-if="conversionWarnings.length">
            <div class="tw-sticky tw-top-0 tw-bg-white">
              <div>Warnings</div>
            </div>
            <div v-for="warning in conversionWarnings" :key="warning">
              <div
                style="min-height: 0px"
                inline-actions
                rounded
                class="tw-text-yellow-500"
              >
                {{ warning }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="q-my-md tw-overflow-y-auto"
          style="max-height: calc(100vh - 57px)"
        >
          <div class="tw-sticky tw-top-0 tw-bg-white">
            <div>Converted Dashboard</div>
          </div>
          <q-input v-model="o2json" filled type="textarea" />
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
    const activeTab = ref("file");
    const timestampField = ref("_timestamp");
    const defaultStreamName = ref("es2");

    const handleFileUpload = () => {
      if (!file.value) {
        return;
      }

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
            timestampField.value,
            defaultStreamName.value
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
      reader.readAsText(file.value[0]);
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
              timestampField.value,
              defaultStreamName.value
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
          timestampField.value,
          defaultStreamName.value
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

    const convertTimestampField = () => {
      const jsonArray = []; // Assuming you have jsonArray available
      const o2ConversionRes = convertKibanaToO2(
        jsonArray,
        timestampField.value,
        defaultStreamName.value
      );
      o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
      conversionErrors.value = o2ConversionRes.errorAndWarningList.errorList;
      conversionWarnings.value = o2ConversionRes.errorAndWarningList.warningList;
    };

    const convertDefaultStreamName = () => {
      const jsonArray = []; // Assuming you have jsonArray available
      const o2ConversionRes = convertKibanaToO2(
        jsonArray,
        timestampField.value,
        defaultStreamName.value
      );
      o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
      conversionErrors.value = o2ConversionRes.errorAndWarningList.errorList;
      conversionWarnings.value = o2ConversionRes.errorAndWarningList.warningList;
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
      activeTab,
      timestampField,
      defaultStreamName,
      convertTimestampField,
      convertDefaultStreamName,
    };
  },
};
</script>

<style scoped></style>
