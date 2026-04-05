// * Root app layout. Mounts current MVP coach views.
import ClientList from './components/ClientList';
import ProgramList from './components/ProgramList';

function App() {
  return (
    <main>
      <h1>Zenkai Engine</h1>

      <ProgramList />
      <ClientList />
    </main>
  );
}

export default App;
