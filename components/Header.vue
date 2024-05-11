<template>
  <q-layout view="hHh lpR fFf" style="min-height: 50px !important">
    <q-header class="bg-white" style="border-bottom: 1px solid #ccc">
      <div class="flex justify-between q-pb-sm">
        <img
          class="appLogo"
          src="/public/img/open_observe_logo.svg"
          @click="goToHome"
        />
        <div class="q-mt-md text-h4">Convert Dashboard</div>
        <div class="q-mr-lg q-mt-md">
          <q-btn flat round dense class="q-mr-sm" @click="goToGithub">
            <img src="/public/img/github.svg" />
          </q-btn>
          <q-btn
            @click="goToWebsite"
            outline
            no-caps
            >Website <q-icon name="open_in_new" size="16px" class="q-ml-sm"
          /></q-btn>
        </div>
      </div>
    </q-header>
    <div class="flex" style="margin-top: 65px; border-bottom: 1px solid #ccc">
      <q-tabs v-model="activePerformanceTab" class="flex justify-start q-ml-lg">
        <div class="text-h6 q-mr-lg">Import Dashboard from</div>
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
  </q-layout>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "Header",
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
      // {
      //   label: "Splunk",
      //   value: "splunk",
      // },
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
