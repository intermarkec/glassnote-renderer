<template>
  <div id="app">
    <!-- Keycode display -->
    <div id="keycode" :style="keycodeStyle">{{ keycodeText }}</div>
    
    <!-- Glass system container -->
    <div id="glass-container"></div>
    
    <!-- Config menu will be rendered here -->
    <div id="config-menu-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { initializeElectronBridge } from './systems/electron-bridge'

const keycodeText = ref('')
const keycodeStyle = computed(() => {
  return {
    opacity: '0.8'
  }
})

onMounted(() => {
  console.log('App.vue mounted - starting initialization')
  
  // Initialize Electron bridge
  console.log('Initializing Electron bridge')
  initializeElectronBridge()
  
  // Initialize systems after component is mounted
  if (window.appInit) {
    console.log('Calling appInit()')
    window.appInit()
  } else {
    console.log('appInit not available')
  }
  
  // Set up keycode display - always set the function
  console.log('Setting up keycode display')
  window.setKeycodeText = (text: string) => {
    keycodeText.value = text
  }

  // Show splash after Vue is fully mounted and systems are initialized
  setTimeout(() => {
    console.log('Attempting to show splash')
    if (window.showSplash) {
      console.log('Calling showSplash()')
      window.showSplash()
    } else {
      console.log('showSplash not available')
    }
  }, 100)
})
</script>

<style>
html {
  background-color: transparent;
}

body {
  margin: 0;
  padding: 0;
  background-color: transparent;
  color: white;
  font-family: Arial, sans-serif;
  font-size: 30px;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  box-sizing: border-box;
  user-select: none;
  overflow: hidden;
}

/* Keycode display styles - copied from previous version */
#keycode {
  opacity: 0.8;
  position: absolute;
  color: #000;
  text-shadow: -1px -1px 0 rgb(136, 136, 136),
    1px -1px 0 rgb(138, 138, 138), -1px 1px 0 rgb(255, 255, 255),
    1px 1px 0 rgb(145, 145, 145);
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90vw;
  z-index: 10001;
  padding: 10px 20px;
  border-radius: 10px;
  /* Default position for landscape */
  left: 5vw;
  bottom: 15vh;
  font-size: 8vh;
  max-font-size: 30pt;
}

/* Vertical orientation (portrait) */
@media (orientation: portrait) {
  #keycode {
    left: 50%;
    bottom: 20vh;
    transform: translateX(-50%);
    font-size: 6vh;
    max-font-size: 30pt;
    text-align: center;
  }
}

/* Larger screens */
@media (min-width: 1200px) and (min-height: 800px) {
  #keycode {
    font-size: 10vh;
    max-font-size: 30pt;
  }
}

/* Very small screens */
@media (max-height: 500px) {
  #keycode {
    font-size: 3vh;
    bottom: 3vh;
    max-font-size: 30pt;
  }
}

/* Sistema de estilos neomórficos */
.neumorphic-container {
  background: #e0e5ec;
  border-radius: 20px;
  box-shadow: 12px 12px 24px #b8bec7, -12px -12px 24px #ffffff;
  border: none;
}

.neumorphic-button {
  background: #e0e5ec;
  border: none;
  border-radius: 15px;
  box-shadow: 8px 8px 16px #b8bec7, -8px -8px 16px #ffffff;
  transition: all 0.2s cubic-bezier(.25,.8,.25,1);
  cursor: pointer;
}

.neumorphic-button:hover {
  box-shadow: 4px 4px 8px #b8bec7, -4px -4px 8px #ffffff;
  transform: translateY(1px);
}

.neumorphic-button:active {
  box-shadow: inset 4px 4px 8px #b8bec7, inset -4px -4px 8px #ffffff;
  transform: translateY(2px);
}

.neumorphic-inset {
  background: #e0e5ec;
  border-radius: 15px;
  box-shadow: inset 4px 4px 8px #b8bec7, inset -4px -4px 8px #ffffff;
}

.neumorphic-card {
  background: #e0e5ec;
  border-radius: 20px;
  box-shadow: 12px 12px 24px #b8bec7, -12px -12px 24px #ffffff;
  border: none;
}

.neumorphic-table {
  background: #e0e5ec;
  border-radius: 12px;
  box-shadow: 4px 4px 8px #b8bec7, -4px -4px 8px #ffffff;
  overflow: hidden;
}

.neumorphic-table-cell {
  background: #e0e5ec;
  box-shadow: inset 2px 2px 4px #b8bec7, inset -2px -2px 4px #ffffff;
}
</style>