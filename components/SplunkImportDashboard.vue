<template>
  <div class="q-mx-md tw-flex tw-flex-row tw-mt-16">
    <!-- Left Side: Imports -->
    <div class="q-mr-md tw-flex:1 tw-w-1/3">
      <!-- Tabs -->
      <q-tabs v-model="activeTab" dense align="justify" class="q-my-md">
        <q-tab no-caps name="file" label="File" />
        <q-tab no-caps name="url" label="URL" />
        <q-tab no-caps name="json" label="Paste Data" />
      </q-tabs>

      <!-- Tab Contents -->
      <q-tab-panels v-model="activeTab">
        <!-- File Import Section -->
        <q-tab-panel name="file">
          <q-form @submit.prevent="handleFileUpload">
            <div class="q-my-md">
              Import Dashboard from exported XML or JSON file
            </div>
            <div class="">
              <!-- File Input -->
              <q-file
                filled
                bottom-slots
                v-model="file"
                label="Drop XML or JSON file here"
                accept=".xml,.json"
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
                <template v-slot:hint>.XML and .JSON files only</template>
              </q-file>
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
            </div>
          </q-form>
        </q-tab-panel>

        <!-- JSON String Import Section -->
        <q-tab-panel name="json">
          <q-form @submit.prevent="handleNDJSONPaste">
            <div class="q-my-md">Import Dashboard from XML or JSON string</div>
            <div class="">
              <!-- JSON Input -->
              <q-input
                v-model="ndjson"
                label="Enter XML or JSON string"
                filled
                dense
                type="textarea"
                color="secondary"
                :disable="isLoading"
                :rules="[
                  (val) => (val && val.length > 0) || 'Please enter JSON',
                ]"
              />
            </div>
          </q-form>
        </q-tab-panel>
      </q-tab-panels>
      <div>
        <div class="q-my-md q-ml-md">Configuration</div>
        <div class="q-ma-md">
          <q-input
            v-model="timestampField"
            class="q-mt-sm"
            filled
            dense
            label="Open API"
            :hint="'Open API '"
          >
          </q-input>
        </div>
        <q-btn
          label="Convert"
          color="secondary"
          class="q-my-md text-bold no-border q-mx-md"
          padding="sm xl"
          type="submit"
          no-caps
          @click="convertDashboardData"
        />
      </div>
    </div>
    <!-- Right Side -->
    <div class="tw-flex:1 q-ml-lg tw-w-2/3">
      <div class="q-mx-md q-my-md tw-h-full">
        <div class="q-my-md tw-overflow-y-auto">
          <div>
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
          <div class="q-my-md tw-overflow-y-auto">
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
        </div>

        <div
          class="q-my-md tw-flex tw-flex-col tw-overflow-y-auto tw-max-h-[calc(calc(100vh-110px)/2)]"
        >
          <div class="tw-sticky tw-top-0 tw-bg-white">
            <div>Converted Dashboard</div>
          </div>
          <q-input class="tw-flex-1" v-model="o2json" filled type="textarea" />
          <div class="q-mx-md">
            <q-btn
              v-if="o2json"
              label="Download JSON"
              color="secondary"
              @click="downloadO2JSON"
              class="q-my-md text-bold no-border"
              padding="sm xl"
              no-caps
            />
            <q-btn
              v-if="o2json"
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
  </div>

  <!-- Loading Overlay -->
  <q-dialog v-model="isLoading" persistent>
    <q-card style="min-width: 250px; max-width: 300px;">
      <q-card-section>
        <div class="text-h6">
          Please wait while we convert your dashboard...
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-spinner color="primary" size="20px" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref } from "vue";
import { convertSplunkXMLToO2 } from "~/lib/splunk/xmlDataConverter";
import { convertSplunkJSONToO2 } from "~/lib/splunk/jsonDataConverter";

export default {
  name: "SplunkImportDashboard",
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
    const timestampField = ref(null);
    const defaultStreamName = ref("es2");

    const handleFileUpload = () => {
      if (!file.value) {
        return;
      }

      isLoading.value = true;
      // Create a new FileReader instance
      let reader = new FileReader();
      console.log("file", file.value[0]);
      // on file load
      reader.onload = async (e) => {
        const fileContent = e.target.result;

        try {
          let o2ConversionRes;

          // Determine whether the content is JSON or XML
          if (isJSON(fileContent)) {
            o2ConversionRes = await convertSplunkJSONToO2(fileContent);
          } else {
            o2ConversionRes = await convertSplunkXMLToO2(fileContent);
          }

          o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
          conversionErrors.value = Object.entries(
            o2ConversionRes.warningErrorList.error
          ).flatMap(([panelName, errors]) =>
            Array.from(errors).map((error) => `${panelName}: ${error}`)
          );
          conversionWarnings.value = Object.entries(
            o2ConversionRes.warningErrorList.warning
          ).flatMap(([panelName, warnings]) =>
            Array.from(warnings).map((warning) => `${panelName}: ${warning}`)
          );

          console.log("o2json", o2json.value);
          console.log("conversionErrors", conversionErrors.value);
        } catch (error) {
          console.log("Error during conversion", error);
          conversionErrors.value = ["Error:" + error.message];
        } finally {
          isLoading.value = false;
        }
      };

      // Read the file as text
      reader.readAsText(file.value[0]);
    };

    const handleURLImport = async () => {
      if (!url.value) return;

      try {
        isLoading.value = true;
        const response = await fetch(url.value);
        const fileContent = await response.text();

        try {
          let o2ConversionRes;

          // Determine whether the content is JSON or XML
          if (isJSON(fileContent)) {
            o2ConversionRes = await convertSplunkJSONToO2(fileContent);
          } else {
            o2ConversionRes = await convertSplunkXMLToO2(fileContent);
          }

          o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
          conversionErrors.value = Object.entries(
            o2ConversionRes.warningErrorList.error
          ).flatMap(([panelName, errors]) =>
            Array.from(errors).map((error) => `${panelName}: ${error}`)
          );
          conversionWarnings.value = Object.entries(
            o2ConversionRes.warningErrorList.warning
          ).flatMap(([panelName, warnings]) =>
            Array.from(warnings).map((warning) => `${panelName}: ${warning}`)
          );
        } catch (error) {
          console.log("Error during conversion", error);
          conversionErrors.value = ["Error:" + error.message];
        } finally {
          isLoading.value = false;
        }
      } catch (error) {
        console.error("Error during conversion", error);
        conversionErrors.value = ["Error:" + error.message];
        isLoading.value = false;
      }
    };

    const handleNDJSONPaste = async () => {
      const fileContent = ndjson.value;
      console.log("fileContent", fileContent);

      try {
        isLoading.value = true;
        let o2ConversionRes;

        // Determine whether the content is JSON or XML
        if (isJSON(fileContent)) {
          o2ConversionRes = await convertSplunkJSONToO2(fileContent);
        } else {
          o2ConversionRes = await convertSplunkXMLToO2(fileContent);
        }

        o2json.value = JSON.stringify(o2ConversionRes.dashboard, null, 2);
        conversionErrors.value = Object.entries(
          o2ConversionRes.warningErrorList.error
        ).flatMap(([panelName, errors]) =>
          Array.from(errors).map((error) => `${panelName}: ${error}`)
        );
        conversionWarnings.value = Object.entries(
          o2ConversionRes.warningErrorList.warning
        ).flatMap(([panelName, warnings]) =>
          Array.from(warnings).map((warning) => `${panelName}: ${warning}`)
        );
      } catch (error) {
        console.error("Error during conversion", error);
        conversionErrors.value = ["Error:" + error.message];
      } finally {
        isLoading.value = false;
      }
    };

    const isJSON = (str) => {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    };

    const downloadO2JSON = () => {
      // download o2json.value
      // prepare json and download via a click
      const o2jsonObject = JSON.parse(o2json.value);

      const title = o2jsonObject.title;
      const data =
        "data:text/json;charset=utf-8," + encodeURIComponent(o2json.value);
      const htmlA = document.createElement("a");
      htmlA.setAttribute("href", data);
      const fileName = `${title}_O2_Dashboard`;
      htmlA.setAttribute("download", fileName + ".json");
      htmlA.click();
    };

    const copyToClipboard = () => {
      navigator.clipboard.writeText(o2json.value);
    };
    const convertDashboardData = () => {
      if (activeTab.value === "file") {
        handleFileUpload();
      } else if (activeTab.value === "url") {
        handleURLImport();
      } else if (activeTab.value === "json") {
        handleNDJSONPaste();
      }
    };
    return {
      file,
      url,
      ndjson,
      isLoading,
      fileImportResults,
      o2json,
      conversionWarnings,
      conversionErrors,
      activeTab,
      timestampField,
      defaultStreamName,
      handleFileUpload,
      handleURLImport,
      handleNDJSONPaste,
      convertDashboardData,
      downloadO2JSON,
      copyToClipboard,
    };
  },
};
</script>

<style scoped></style>