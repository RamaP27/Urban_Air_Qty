import { useEffect, useMemo, useState } from 'react';
import { Activity, Wind, MapPin, RefreshCw, ShieldCheck, Sparkles, AlertTriangle, Droplets } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const DEFAULTS = { lat: '12.9716', lon: '77.5946', location: 'Bengaluru' };

function formatValue(value, unit = '') {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}${unit}`;
}
function statusClass(category = '') {
  if (category === 'Good') return 'good';
  if (category === 'Moderate') return 'moderate';
  if (category.includes('Sensitive')) return 'sensitive';
  return 'poor';
}

export default function App() {
  const [coords, setCoords] = useState(DEFAULTS);
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const query = `lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`;
      const [currentRes, forecastRes] = await Promise.all([
        fetch(`${API}/api/air-quality/current?${query}`),
        fetch(`${API}/api/air-quality/forecast?${query}`)
      ]);
      if (!currentRes.ok) {
        const errPayload = await currentRes.json().catch(() => ({}));
        throw new Error(errPayload.detail || 'Could not load air-quality data.');
      }
      if (!forecastRes.ok) throw new Error('Could not load trend data.');
      const current = await currentRes.json();
      const future = await forecastRes.json();
      setData(current); setForecast(future.points || []);
      const insightRes = await fetch(`${API}/api/insights`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: coords.location, readings: current.readings })
      });
      if (insightRes.ok) setInsights(await insightRes.json());
    } catch (e) { setError(e.message || 'Unexpected error.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const chartData = useMemo(() => forecast.map(p => ({
    time: p.time ? new Date(p.time).toLocaleTimeString([], { hour: '2-digit' }) : '',
    AQI: p.us_aqi, 'PM2.5': p.pm2_5
  })), [forecast]);

  const readings = data?.readings || {};
  const pollutants = [
    { label: 'PM2.5', key: 'pm2_5', unit: ' µg/m³', icon: Droplets },
    { label: 'PM10', key: 'pm10', unit: ' µg/m³', icon: Wind },
    { label: 'Nitrogen dioxide', key: 'nitrogen_dioxide', unit: ' µg/m³', icon: Activity },
    { label: 'Ozone', key: 'ozone', unit: ' µg/m³', icon: Sparkles },
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Wind size={21}/></div><div><strong>Atmos</strong><span>URBAN AIR INTELLIGENCE</span></div></div>
      <div className="live"><i/> LIVE DATA MONITOR</div>
    </header>
    <main>
      <section className="hero">
        <div><p className="eyebrow">CITY ENVIRONMENTAL INTELLIGENCE</p><h1>See the air.<br/><em>Shape a healthier city.</em></h1>
          <p className="hero-copy">A unified view of urban air quality, emerging pollution patterns, and practical actions for city stakeholders.</p></div>
        <div className="hero-orb"><div className="orb-inner"><Wind size={52}/><span> AIR<br/>MATTERS</span></div></div>
      </section>

      <section className="toolbar">
        <div className="location-label"><MapPin size={17}/><span>MONITORING LOCATION</span></div>
        <input aria-label="Location name" value={coords.location} onChange={e=>setCoords({...coords, location:e.target.value})}/>
        <input aria-label="Latitude" value={coords.lat} onChange={e=>setCoords({...coords, lat:e.target.value})}/>
        <input aria-label="Longitude" value={coords.lon} onChange={e=>setCoords({...coords, lon:e.target.value})}/>
        <button onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/>{loading?'Updating':'Refresh data'}</button>
      </section>

      {error && <div className="error"><AlertTriangle size={18}/>{error}<span>Ensure the backend is running and internet access is available.</span></div>}

      <section className="section-head"><div><p className="eyebrow">CURRENT CONDITIONS</p><h2>Air quality overview</h2></div><span className="source">{data?.source || 'Waiting for data'} {data?.timestamp ? `· ${new Date(data.timestamp).toLocaleString()}` : ''}</span></section>
      <section className="overview-grid">
        <div className="aqi-card">
          <div className="card-top"><span>US AIR QUALITY INDEX</span><Activity size={18}/></div>
          <div className="aqi-number">{readings.us_aqi ?? '—'}</div>
          <span className={`status ${statusClass(data?.category)}`}>{data?.category || 'Awaiting reading'}</span>
          <p>{data?.description || 'Connect to the API to retrieve the latest available reading.'}</p>
          <div className="scale"><span>0</span><div><i/></div><span>300+</span></div>
        </div>
        <div className="pollutant-grid">
          {pollutants.map(({label,key,unit,icon:Icon})=><div className="metric-card" key={key}>
            <div className="metric-icon"><Icon size={18}/></div><span>{label}</span><strong>{formatValue(readings[key], unit)}</strong><small>Latest available value</small>
          </div>)}
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">HOURLY PATTERN</p><h2>Pollution trend</h2></div><span className="legend"><i/> US AQI</span></div>
          <div className="chart">{chartData.length ? <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}><defs><linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65d6bd" stopOpacity={0.3}/><stop offset="100%" stopColor="#65d6bd" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 5" stroke="#263746"/><XAxis dataKey="time" tick={{fill:'#91a3b2',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#91a3b2',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#122333',border:'1px solid #304556',borderRadius:10}}/>
              <Area type="monotone" dataKey="AQI" stroke="#65d6bd" strokeWidth={2.5} fill="url(#aqiFill)" connectNulls/>
            </AreaChart></ResponsiveContainer> : <div className="empty-chart">Hourly readings will appear here when the API responds.</div>}</div>
          <p className="footnote">Provider-supplied hourly series · indicative environmental data</p>
        </div>
        <div className="panel insight-panel">
          <div className="panel-heading"><div><p className="eyebrow">GENAI DECISION SUPPORT</p><h2><Sparkles size={19}/> City insights</h2></div><span className="ai-tag">AI</span></div>
          {insights ? <><p className="insight-summary">{insights.summary}</p>
            {insights.recommendations?.length > 0 && <ul>{insights.recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul>}
            <div className="generated">Generated by {insights.generated_by}</div>
          </> : <p className="muted">Insights will be generated after the first successful data refresh.</p>}
          <div className="safety-note"><ShieldCheck size={17}/><span>Decision support only. Verify readings with calibrated local stations before taking consequential action.</span></div>
        </div>
      </section>
      <footer><span>ATMOS · URBAN AIR QUALITY INTELLIGENCE</span><span>Built for healthier, data-informed cities</span></footer>
    </main>
  </div>;
}
