import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider } from './store'
import { TemaProvider } from './tema'
import { RealtimeProvider } from './realtime'
import Layout, { Privada } from './components/Layout'
import { Cadastro, Login } from './pages/Auth'
import Mural from './pages/Mural'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import { Chat, Conversas } from './pages/Conversas'
import Painel from './pages/Painel'
import { Ajuda, NaoEncontrada, Perfil } from './pages/Perfil'

function RolarTopo() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <TemaProvider>
    <StoreProvider>
      <BrowserRouter>
       <RealtimeProvider>
        <RolarTopo />
        <Routes>
          <Route path="/entrar" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route element={<Layout />}>
            <Route index element={<Mural />} />
            <Route path="item/:id" element={<ItemDetail />} />
            <Route path="novo" element={<Privada><ItemForm key="novo" /></Privada>} />
            <Route path="editar/:id" element={<Privada><ItemForm key="editar" /></Privada>} />
            <Route path="conversas" element={<Privada><Conversas /></Privada>} />
            <Route path="conversas/:id" element={<Privada><Chat /></Privada>} />
            <Route path="painel" element={<Privada admin><Painel /></Privada>} />
            <Route path="perfil" element={<Privada><Perfil /></Privada>} />
            <Route path="ajuda" element={<Ajuda />} />
            <Route path="*" element={<NaoEncontrada />} />
          </Route>
        </Routes>
       </RealtimeProvider>
      </BrowserRouter>
    </StoreProvider>
    </TemaProvider>
  )
}
