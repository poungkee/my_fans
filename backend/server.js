// backend/server.js
const app = require('./news/app')
const { PORT } = require('./news/config')

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`)
})
