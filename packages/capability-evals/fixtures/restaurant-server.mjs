import { createServer } from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const restaurants = [
  { id: 'garden', name: 'Garden Table', cuisine: 'Mediterranean', neighborhood: 'Cambridge', pricePerPerson: 45, stepFree: true, vegan: true, quiet: true, capacity: 8 },
  { id: 'loft', name: 'Harbor Loft', cuisine: 'Seafood', neighborhood: 'Boston', pricePerPerson: 80, stepFree: false, vegan: false, quiet: false, capacity: 10 },
  { id: 'cafe', name: 'Canal Kitchen', cuisine: 'Modern American', neighborhood: 'Cambridge', pricePerPerson: 60, stepFree: true, vegan: true, quiet: false, capacity: 6 },
];
export async function startRestaurantServer({ statePath = resolve('restaurant-state.json'), port = 0 } = {}) {
  let state;
  try { state = JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = { schemaVersion: 1, bookings: [], events: [] }; }
  let queue = Promise.resolve();
  const save = async (next) => { await writeFile(`${statePath}.tmp`, JSON.stringify(next, null, 2)); await rename(`${statePath}.tmp`, statePath); state = next; };
  const server = createServer((req, res) => {
    queue = queue.then(async () => {
      const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
      try {
        const url = new URL(req.url, 'http://localhost');
        if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); res.end(page); return; }
        if (req.method === 'GET' && url.pathname === '/api/restaurants') return reply(200, restaurants);
        if (req.method === 'GET' && url.pathname === '/api/bookings') return reply(200, state);
        if (req.method === 'GET' && url.pathname === '/api/availability') {
          const restaurant = restaurants.find(r => r.id === url.searchParams.get('restaurantId'));
          if (!restaurant) return reply(400, { error: 'Choose a restaurant' });
          const occupied = state.bookings.filter(b => b.status === 'confirmed' && b.restaurantId === restaurant.id && b.date === url.searchParams.get('date') && b.time === url.searchParams.get('time')).reduce((sum,b) => sum+b.partySize,0);
          return reply(200, { available: restaurant.capacity-occupied, fictional: true });
        }
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(403, { error: 'Same-origin actions only' });
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 8192) return reply(413, { error: 'Request too large' }); }
        const body = raw ? JSON.parse(raw) : {};
        const id = url.pathname.match(/^\/api\/bookings\/([a-f0-9-]+)$/)?.[1];
        if (!(req.method === 'POST' && url.pathname === '/api/bookings') && !(id && ['PATCH', 'DELETE'].includes(req.method))) return reply(404, { error: 'Unknown route' });
        const next = structuredClone(state);
        const existing = id && next.bookings.find(b => b.id === id);
        if (id && (!existing || existing.status !== 'confirmed')) return reply(404, { error: 'Active reservation not found' });
        if (req.method === 'DELETE') { existing.status = 'cancelled'; next.events.push({ kind: 'cancelled', booking: structuredClone(existing), at: new Date().toISOString() }); await save(next); return reply(200, existing); }
        const restaurant = restaurants.find(r => r.id === body.restaurantId);
        if (!restaurant || !Number.isInteger(body.partySize) || body.partySize < 1 || body.partySize > restaurant.capacity || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || !['17:30','19:00','20:30'].includes(body.time) || typeof body.name !== 'string' || !body.name.trim()) return reply(400, { error: 'Choose a restaurant, valid date/time, party size and guest name' });
        const occupied = next.bookings.filter(b => b.id !== id && b.status === 'confirmed' && b.restaurantId === restaurant.id && b.date === body.date && b.time === body.time).reduce((sum,b) => sum+b.partySize,0);
        if (occupied + body.partySize > restaurant.capacity) return reply(409, { error: 'That time is unavailable for this party' });
        const booking = { id: id || randomUUID(), status: 'confirmed', restaurantId: restaurant.id, name: body.name.trim().slice(0,120), partySize: body.partySize, date: body.date, time: body.time };
        if (existing) Object.assign(existing, booking); else next.bookings.push(booking);
        next.events.push({ kind: existing ? 'modified' : 'booked', booking: structuredClone(booking), at: new Date().toISOString() });
        await save(next); reply(existing ? 200 : 201, booking);
      } catch { reply(400, { error: 'Request could not be completed' }); }
    }).catch(() => { if (!res.writableEnded) res.end(); });
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: async () => { await queue; await new Promise(resolve => server.close(resolve)); } };
}
const page = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fictional restaurant reservations</title><style>body{font:18px system-ui;max-width:850px;margin:40px auto;padding:20px}label,button{display:block;margin:12px 0}input,select,button{font:inherit;padding:8px}article{border:1px solid #aaa;padding:16px;margin:15px 0}</style><h1>Celebration Tables</h1><p>Fictional local sandbox. No real booking or payment occurs. Prices and availability are fixture data.</p><label>Search restaurants<input id="search" placeholder="Cuisine or neighborhood"></label><section id="restaurants"></section><h2>Reservation</h2><form id="booking"><label>Restaurant<select id="restaurant"></select></label><label>Guest name<input id="guest" required></label><label>Party size<input id="party" type="number" min="1" max="10" value="2" required></label><label>Date<input id="date" type="date" required></label><label>Time<select id="time"><option>17:30</option><option>19:00</option><option>20:30</option></select></label><button>Book reservation</button><button type="button" id="availability">Check availability</button></form><p role="status" id="status"></p><h2>Confirmation records</h2><section id="records"></section><script>
let restaurants=[],editing=null;
const $=id=>document.getElementById(id);
async function request(path,method,body){const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}
function renderRestaurants(){ $('restaurants').replaceChildren();for(const r of restaurants.filter(r=>JSON.stringify(r).toLowerCase().includes($('search').value.toLowerCase()))){const a=document.createElement('article');a.textContent=r.name+' · '+r.cuisine+' · '+r.neighborhood+' · $'+r.pricePerPerson+' per person · Step-free: '+r.stepFree+' · Vegan: '+r.vegan+' · Quiet: '+r.quiet+' · Capacity: '+r.capacity; $('restaurants').append(a);}}
async function records(){const state=await request('/api/bookings','GET');$('records').replaceChildren();for(const b of state.bookings){const a=document.createElement('article');const text=document.createElement('p');text.textContent=b.id+' · '+b.status+' · '+b.restaurantId+' · '+b.date+' '+b.time+' · '+b.partySize+' guests';a.append(text);if(b.status==='confirmed'){const edit=document.createElement('button');edit.textContent='Modify '+b.id;edit.onclick=()=>{editing=b.id;$('restaurant').value=b.restaurantId;$('guest').value=b.name;$('party').value=b.partySize;$('date').value=b.date;$('time').value=b.time;$('booking').querySelector('button').textContent='Save reservation changes';};const cancel=document.createElement('button');cancel.textContent='Cancel '+b.id;cancel.onclick=async()=>{try{await request('/api/bookings/'+b.id,'DELETE');$('status').textContent='Cancelled '+b.id;await records();}catch(e){$('status').textContent=e.message;}};a.append(edit,cancel);}$('records').append(a);}}
$('search').oninput=renderRestaurants;
$('availability').onclick=async()=>{try{const p=new URLSearchParams({restaurantId:$('restaurant').value,date:$('date').value,time:$('time').value});const a=await request('/api/availability?'+p,'GET');$('status').textContent=a.available+' seats available (fictional)';}catch(e){$('status').textContent=e.message;}};
$('booking').onsubmit=async e=>{e.preventDefault();try{const b=await request('/api/bookings'+(editing?'/'+editing:''),editing?'PATCH':'POST',{restaurantId:$('restaurant').value,name:$('guest').value,partySize:Number($('party').value),date:$('date').value,time:$('time').value});$('status').textContent='Confirmed '+b.id;editing=null;$('booking').querySelector('button').textContent='Book reservation';await records();}catch(e){$('status').textContent=e.message;}};
(async()=>{restaurants=await request('/api/restaurants','GET');for(const r of restaurants){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;$('restaurant').append(o);}renderRestaurants();await records();})();
</script></html>`;
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) { const server = await startRestaurantServer(); console.log(server.origin); for (const signal of ['SIGINT','SIGTERM']) process.once(signal, async()=>{await server.close();process.exitCode=0;}); }
