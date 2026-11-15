import React,{lazy,Suspense} from 'react';import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import './i18n';import PlatformGate from './PlatformGate';import './global.css';
const App=lazy(()=>import('./App'));
const client=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><PlatformGate><QueryClientProvider client={client}><Suspense fallback={<p role="status">PLANET X · SPHEREx</p>}><App/></Suspense></QueryClientProvider></PlatformGate></React.StrictMode>);
