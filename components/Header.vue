<template>
  <q-layout view="hHh lpR fFf" style="min-height: 50px !important">
    <q-header class="bg-white" style="border-bottom: 1px solid #ccc">
      <div class="flex justify-between q-pb-sm">
        <img
          class="appLogo"
          src="/public/img/open_observe_logo.svg"
          @click="goToHome"
        />
        <div class="q-mt-md text-h6">Convert Dashboard</div>
        <div class="q-mr-lg q-mt-md">
          <q-btn flat round dense class="q-mr-sm" @click="goToGithub">
            <img src="/public/img/github.svg" />
          </q-btn>
          <q-btn @click="goToWebsite" no-caps
            >Website <q-icon name="open_in_new" size="16px" class="q-ml-sm"
          /></q-btn>
        </div>
      </div>
      <q-separator style="border-bottom: 1px solid #ccc" />
      <div
        class="flex"
        style="border-bottom: 1px solid #ccc; position: sticky; top: 0"
      >
        <q-tabs
          v-model="activePerformanceTab"
          class="flex justify-start q-ml-lg"
        >
          <div class="tw-text-base q-mr-lg">Import Dashboard from</div>
          <q-tab
            v-for="tab in tabs"
            :key="tab.value"
            :name="tab.value"
            class="text-primary"
          >
            {{ tab.label }}
          </q-tab>
        </q-tabs>
      </div>
    </q-header>
  </q-layout>
  <KibanaImportDashboard v-if="tabs[0].value === activePerformanceTab" />
  <SplunkImportDashboard v-if="tabs[1].value === activePerformanceTab" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import KibanaImportDashboard from "./KibanaImportDashboard.vue";
import SplunkImportDashboard from "./SplunkImportDashboard.vue";

export default defineComponent({
  name: "Header",
  components: {
    KibanaImportDashboard,
    SplunkImportDashboard,
  },
  setup() {
    const goToHome = () => {
      window.location.href = "/";
    };

    const goToGithub = () => {
      window.open(
        "https://github.com/openobserve/Kibana_to_O2_Dashboards",
        "_blank"
      );
    };

    const goToWebsite = () => {
      window.open("https://openobserve.ai/", "_blank");
    };

    const activePerformanceTab = ref("kibana");

    const tabs = [
      {
        label: "Kibana",
        value: "kibana",
      },
      {
        label: "Splunk",
        value: "splunk",
      },
      // {
      //   label: "Grafana",
      //   value: "grafana",
      // },
    ];

    return {
      goToHome,
      goToGithub,
      goToWebsite,
      tabs,
      activePerformanceTab,
    };
  },
});
</script>

<style scoped>
.q-header {
  color: unset;

  .appLogo {
    margin-left: 20px;
    margin-right: 0;
    margin-top: 10px;
    width: 150px;
    cursor: pointer;
  }
}
</style>
