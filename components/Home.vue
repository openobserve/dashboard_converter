<template>
  <div class="container">
    <div class="tab-buttons">
      <button
        class="tab-button"
        :class="{ active: tab === 'file' }"
        @click="tab = 'file'"
      >
        Upload a file
      </button>
      <button
        class="tab-button"
        :class="{ active: tab === 'url' }"
        @click="tab = 'url'"
      >
        Input a URL
      </button>
      <button
        class="tab-button"
        :class="{ active: tab === 'paste' }"
        @click="tab = 'paste'"
      >
        Paste data
      </button>
    </div>

    <div v-if="tab === 'file'" class="tab-content">
      <div class="dropzone" id="dropzone">
        <h1>Drop a file or click to select a file</h1>
        <input type="file" id="fileupload" @change="handleFileUpload" />
        <label for="fileupload" class="upload-label">Choose a file</label>
      </div>
    </div>

    <div v-if="tab === 'url'" class="tab-content">
      <input type="text" v-model="url" placeholder="Enter URL" />
      <button @click="handleURLImport">Import</button>
    </div>

    <div v-if="tab === 'paste'" class="tab-content">
      <textarea v-model="ndjson" rows="10"></textarea>
      <button @click="handleNDJSONPaste">Import</button>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { convertKibanaToO2 } from "~/lib";
export default {
  name: "Home",
  setup() {
    const tab = ref("file");
    const file = ref(null);
    const url = ref("");
    const ndjson = ref("");

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
          convertKibanaToO2(jsonArray);
        } catch (error) {
          // not able to parse json
          // ie. not NDJSON
          console.log("The file is not NDJSON", error);
        }
      };

      // Read the file as text
      reader.readAsText(file.value);
    };

    const handleURLImport = () => {
      // handle URL import here, using url.value
    };

    const handleNDJSONPaste = () => {
      // handle NDJSON paste here, using ndjson.value
    };

    return {
      tab,
      file,
      url,
      ndjson,
      handleFileUpload,
      handleURLImport,
      handleNDJSONPaste,
    };
  },
};
</script>

<style scoped>
.container {
  margin: 0 auto;
  padding: 10px 0px 0px 0px;
  border-radius: 10px;
}

.tab-buttons {
  margin-bottom: 20px;
}

.tab-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px;
  font-size: 16px;
  color: #333;
  transition: color 0.3s ease;
}

.tab-button.active {
  color: #007bff;
}

.tab-content input[type="text"],
.tab-content textarea {
  display: block;
  width: 500px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.tab-content button {
  background: #0056b3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.tab-content button:hover {
  background: #0056b3;
}

body {
  font-family: Arial, sans-serif;
  background-color: #f3f3f3;
}

.dropzone {
  width: 500px;
  height: 300px;
  border: 5px dashed #ccc;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  position: relative;
  transition: background-color 0.3s;
}

.dropzone.dragover {
  background-color: #d3d3d3;
}

.dropzone h1 {
  color: #0056b3;
  margin-bottom: 10px;
}

.dropzone p {
  color: #0056b3;
  margin-bottom: 10px;
}

#fileupload {
  display: none;
}

.upload-label {
  display: inline-block;
  padding: 10px 18px;
  background-color: #0056b3;
  color: #fff;
  cursor: pointer;
  border-radius: 5px;
  text-transform: uppercase;
  border: 2px solid #0056b3;
}

.upload-label:hover {
  background-color: #fff;
  color: #0056b3;
  border: 2px solid #0056b3;
}
</style>
