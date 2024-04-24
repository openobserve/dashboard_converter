<template>
  <q-layout view="hHh lpR fFf" style="min-height: 50px !important">
    <q-header class="bg-white" style="border-bottom: 1px solid #ccc">
      <div class="flex justify-between q-pb-sm">
        <img
          class="appLogo"
          src="/public/img/open_observe_logo.svg"
          @click="goToHome"
        />
        <div class="q-mr-lg q-mt-md">
          <q-btn flat round dense class="q-mr-sm" @click="goToGithub">
            <img src="/public/img/github.svg" />
          </q-btn>
          <q-btn @click="goToWebsite">Website</q-btn>
        </div>
      </div>
    </q-header>
  </q-layout>
</template>

<script lang="ts">
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
    return {
      goToHome,
      goToGithub,
      goToWebsite,
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
