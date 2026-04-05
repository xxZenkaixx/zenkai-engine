// Root app layout. Mounts main client management view.
import ClientList from './components/ClientList';

function App() {
  return (
    <main>
      <h1>Zenkai Engine</h1>
      <ClientList />
    </main>
  );
}

export default App;
