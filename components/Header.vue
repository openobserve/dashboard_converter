<template>
  <q-layout view="hHh lpR fFf" style="min-height: 50px !important">
    <q-header class="bg-white" style="border-bottom: 1px solid #ccc">
      <div class="flex justify-between q-pb-sm">
        <div class="flex relative-position q-mr-sm">
          <img
            class="appLogo"
            loading="eager"
            src="/public/img/open_observe_logo.svg"
            @click="goToHome"
          />
          <span class="absolute beta-text">Beta</span>
        </div>
        <div class="q-mt-md text-h6">Dashboard Converter</div>
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
          <q-tab
            v-for="tab in tabs"
            no-caps
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
        "https://github.com/openobserve/dashboard_converter",
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

  .beta-text {
    font-size: 11px;
    right: 1px;
    bottom: 0px;
  }

  .appLogo {
    margin-left: 0.5rem;
    margin-right: 0;
    width: 150px;
    cursor: pointer;

    &__mini {
      margin-right: 0.25rem;
      height: 30px;
      width: 30px;
    }
  }
}
</style>
