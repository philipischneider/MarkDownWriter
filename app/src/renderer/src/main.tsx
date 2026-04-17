import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'prosemirror-view/style/prosemirror.css'
import 'prosemirror-example-setup/style/style.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
