// Servidor da API para desenvolvimento local (npm run dev). No Vercel quem roda é api/index.js
import 'dotenv/config'
import app from './app.js'

const porta = process.env.API_PORT || 3001
app.listen(porta, () => console.log(`API rodando em http://localhost:${porta}`))
