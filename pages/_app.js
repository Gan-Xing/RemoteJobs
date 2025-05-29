import '@/styles/globals.css';
import { SSEProvider } from '@/components/shared/SSEProvider';

function MyApp({ Component, pageProps }) {
  return (
    <SSEProvider>
      <Component {...pageProps} />
    </SSEProvider>
  );
}

export default MyApp; 