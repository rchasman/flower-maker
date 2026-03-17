import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { flowerRoutes } from './src/routes/flower.ts'

const app = new Hono()

app.use('/*', cors())
app.route('/api/flower', flowerRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default {
  port: 3001,
  fetch: app.fetch,
}
