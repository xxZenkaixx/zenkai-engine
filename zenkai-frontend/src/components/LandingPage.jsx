import { useState, useEffect } from 'react';
import './LandingPage.css';

export default function LandingPage({ onDone }) {
  const [exploding, setExploding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExploding(true), 2850);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="landing-shell">
      <h1 className="landing-title">ZENKAI-ENGINE</h1>
      <p
        className={`landing-kanji${exploding ? ' landing-kanji--explode' : ''}`}
        onAnimationEnd={(e) => {
          if (e.animationName === 'kanji-explode') onDone();
        }}
      >
        全快
      </p>
    </div>
  );
}
