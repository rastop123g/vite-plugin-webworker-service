import { defineConfig } from 'vite'
import plug from './worker-service-plugin'

export default defineConfig({
  plugins: [plug()]
})
