import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './app/App';
import 'antd/dist/reset.css';
import './app/styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={{ token: { colorPrimary: '#2458b8', borderRadius: 6 } }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
