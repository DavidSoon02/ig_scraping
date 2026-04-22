import fs from "fs";
import puppeteer from "puppeteer";
import { parse } from "json2csv";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import dotenv from "dotenv";
// Chart rendering is imported dynamically later to allow running without native canvas

// Cargar variables de .env
dotenv.config();

// --- CONFIGURACIÃ"N ---
const YOUR_USERNAME = process.env.YOUR_USERNAME;
const YOUR_PASSWORD = process.env.YOUR_PASSWORD;
const TARGET_USERNAME = process.env.TARGET_USERNAME;
const MAX_POSTS = 5;
const MAX_COMMENTS_PER_POST = 100; // Límite de seguridad
const MAX_LIKERS_PER_POST = 500; // Límite de seguridad

// --- UTILIDADES HUMANAS ---
const delay = (ms) => new Promise(r => setTimeout(r, ms + Math.random() * 500));

async function humanMouseMove(page) {
  const { width, height } = page.viewport();
  const x = Math.floor(Math.random() * width);
  const y = Math.floor(Math.random() * height);
  await page.mouse.move(x, y, { steps: 10 });
}

async function randomScroll(page, selector = null) {
  await page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) : window;
    if (el) {
      const amount = Math.floor(Math.random() * 300) + 100;
      if (el === window) window.scrollBy(0, amount);
      else el.scrollBy(0, amount);
    }
  }, selector);
  await delay(1000);
}

(async () => {
  console.log("Iniciando sesión...");
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // --- LOGIN ---
  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // intento robusto para encontrar el formulario de login (varias UI posibles)
  const usernameSelectors = [
    "input[name='username']",
    "input[name='email']",
    "input[aria-label*='NÃºmero']",
    "input[aria-label*='username']",
    "input[class*='x1i10hfl']",
    "input[type='text']",
  ];

  let usernameSel = null;
  for (const sel of usernameSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      usernameSel = sel;
      break;
    } catch {}
  }

  if (!usernameSel) {
    console.log("Selector de usuario no encontrado inicialmente, intentando cerrar y reintentar...");
    try {
      const buttons = await page.$x("//button[contains(., 'Aceptar') or contains(., 'Accept') or contains(., 'Log in') or contains(., 'Iniciar sesiÃ³n')]");
      if (buttons.length) {
        await buttons[0].click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch {}

    for (const sel of usernameSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        usernameSel = sel;
        break;
      } catch {}
    }
  }

  if (!usernameSel) throw new Error("No se encontro input de usuario en la pagina de login.");
  await humanMouseMove(page);
  await page.type(usernameSel, YOUR_USERNAME, { delay: 100 });
  await delay(1000);

  const passwordSelectors = [
    "input[name='password']",
    "input[name='pass']",
    "input[type='password']",
    "input[class*='x1i10hfl'][type='password']",
  ];

  let passwordSel = null;
  for (const sel of passwordSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      passwordSel = sel;
      break;
    } catch {}
  }

  if (!passwordSel) {
    console.log("ðŸ” No se encontrÃ³ input de contraseÃ±a con selectores comunes; reintentando despuÃ©s de un pequeÃ±o retraso...");
    await new Promise(r => setTimeout(r, 2000));
    for (const sel of passwordSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        passwordSel = sel;
        break;
      } catch {}
    }
  }

  if (!passwordSel) throw new Error("No se encontrÃ³ input de contraseÃ±a en la pÃ¡gina de login.");
  await humanMouseMove(page);
  await page.type(passwordSel, YOUR_PASSWORD, { delay: 100 });
  await delay(1000);

  // intentar enviar (fallback a Enter si no hay botÃ³n tipo submit)
  try {
    await page.click("button[type='submit']");
  } catch {}
  try {
    await page.keyboard.press('Enter');
  } catch {}

  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
  console.log("âœ… Login exitoso.");

  // --- PERFIL OBJETIVO ---
  console.log("ðŸ“¸ Abriendo perfil objetivo...");
  await page.goto(`https://www.instagram.com/${TARGET_USERNAME}/`, {
    waitUntil: "networkidle2",
  });
  // --- NUEVA LÃ“GICA: EXTRAER 5 PUBLICACIONES MÃS RECIENTES ---
  console.log("ðŸ“¸ Obteniendo enlaces de las publicaciones...");
  const profileSelectors = ["article", "main", "div[role='main']", "section"];
  let found = false;
  for (const sel of profileSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      found = true;
      break;
    } catch {}
  }

  // intentar cerrar posibles diÃ¡logos que cubran el contenido
  try {
    const closeBtns = await page.$x("//button[contains(., 'Cerrar') or contains(., 'Close') or contains(., 'X')]");
    if (closeBtns.length) { await closeBtns[0].click(); await new Promise(r => setTimeout(r, 2000)); }
  } catch {}

  // recoger los primeros 5 enlaces a publicaciones desde mÃºltiples ubicaciones
  let postUrls = await page.$$eval('a[href*="/p/"]', (nodes) => nodes.map((n) => n.href).filter(Boolean));
  if (!postUrls || postUrls.length === 0) {
    // intentar buscar dentro de 'article' o 'main' manualmente
    postUrls = await page.$$eval('article a, main a, section a', (nodes) =>
      nodes.map((n) => n.href).filter(h => h && h.includes('/p/'))
    );
  }

  // asegurar orden real y tomar el mÃ¡ximo configurado
  const uniquePosts = [...new Set(postUrls)].slice(0, MAX_POSTS);
  console.log(`âœ… Se encontraron ${uniquePosts.length} publicaciones (objetivo: ${MAX_POSTS}).`);

  const postsData = [];

  for (let idx = 0; idx < uniquePosts.length; idx++) {
    const postUrl = uniquePosts[idx];
    console.log(`ðŸ”Ž Procesando publicaciÃ³n ${idx + 1}: ${postUrl}`);
    try {
      await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
      // esperar por alguno de los selectores que suelen contener el post
      const postSelectors = ["article", "main article", "div[role='main'] article", "section"];
      let postFound = false;
      for (const sel of postSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 5000 });
          postFound = true;
          break;
        } catch {}
      }
      if (!postFound) {
        // Si no se encuentra el artÃ­culo, intentar un pequeÃ±o retraso y reintento
        await new Promise(r => setTimeout(r, 2000));
        for (const sel of postSelectors) {
          try {
            await page.waitForSelector(sel, { timeout: 5000 });
            postFound = true;
            break;
          } catch {}
        }
      }
      if (!postFound) throw new Error('No se encontrÃ³ el contenido del post (selectors tried).');

      // --- CARGAR TODOS LOS COMENTARIOS ---
      console.log('ðŸ“‘ Cargando todos los comentarios...');
      try {
        let hasMore = true;
        let loadCount = 0;
        while (hasMore && loadCount < 20) { // LÃ­mite de seguridad para evitar loops infinitos
          const loadMoreBtn = await page.$('svg[aria-label*="Cargar mÃ¡s"], svg[aria-label*="Load more"], span[class*="x1lliihq"][class*="x1plvlek"]');
          const viewMoreBtn = (await page.$x("//span[contains(., 'Ver mÃ¡s comentarios') or contains(., 'View more comments')]"))[0];
          
          const btn = loadMoreBtn || viewMoreBtn;
          if (btn) {
            await btn.click();
            await delay(1500);
            loadCount++;
          } else {
            hasMore = false;
          }
        }
        
        // Expandir respuestas
        const replyBtns = await page.$x("//span[contains(., 'Ver respuestas') or contains(., 'View replies')]");
        for (const btn of replyBtns) {
          try {
            await btn.click();
            await delay(800);
          } catch {}
        }
      } catch (e) {
        console.log('âš ï¸  Error al cargar comentarios: ' + e.message);
      }

      // extraer descripciÃ³n, fecha, likes visibles y comentarios
      const info = await page.evaluate(() => {
        const meta = document.querySelector('meta[property="og:description"]')?.content || "";

        let description = "No disponible";
        if (meta) {
          // intentar limpiar la parte inicial de la descripciÃ³n
          const parts = meta.split(' on Instagram: ');
          if (parts.length > 1) {
            description = parts[1].split('â€¢')[0].split('likes')[0].split('â€“')[0].trim();
          } else {
            description = meta.split('â€¢')[0].trim();
          }
          if (!description) description = "No disponible";
        } else {
          const cap = document.querySelector('div.C4VMK span') || document.querySelector('article div[role="presentation"] span');
          if (cap) description = cap.textContent.trim();
        }

        const timeEl = document.querySelector('time');
        const date = timeEl ? timeEl.getAttribute('datetime') || timeEl.textContent.trim() : 'No disponible';

        // likes: intentar parsear desde meta o buscar elementos con texto 'likes' o 'me gusta'
        let likes = 'No disponible';
        const likeEl = Array.from(document.querySelectorAll('a, button, span')).find(el => /\d[\d,.]*\s*(likes|me gusta|Like|likes)/i.test(el.textContent));
        if (likeEl) likes = likeEl.textContent.trim();
        else {
          const m = meta.match(/(\d[\d,.]*)\s+(likes|me gusta)/i);
          if (m) likes = m[1];
        }

        // obtener comentarios visibles (mÃºltiples estrategias para distintas versiones de DOM)
        const comments = [];
        // Estrategia 1: estructura en lista dentro del article / dialog (li que contienen anchor + spans)
        const liCandidates = Array.from(document.querySelectorAll('article ul li, article li, div.C7I1, div.C4VMK'));
        for (const li of liCandidates) {
          try {
            const userEl = li.querySelector('a') || li.querySelector('h3') || li.querySelector('a[href^="/"]');
            const user = userEl ? (userEl.textContent || '').trim() : null;

            const spanTexts = Array.from(li.querySelectorAll('span')).map(s => (s.textContent || '').trim()).filter(Boolean);
            let text = null;
            if (spanTexts.length > 0) {
              // normalmente el primer span es el usuario, el resto es el texto; tomar todo excepto el primero
              if (spanTexts.length >= 2) text = spanTexts.slice(1).join(' ').trim();
              else text = spanTexts[0];
            }

            // fallback: si no hay spans, intentar obtener el texto completo del nodo excluyendo el usuario
            if ((!text || text.length === 0) && user) {
              const raw = (li.innerText || '').trim();
              text = raw.replace(user, '').trim();
            }

            if (user && text && text.length > 0) comments.push({ user, text });
          } catch (e) {
            /* ignorar nodos que fallen */
          }
        }

        // Estrategia 2: selector directo de bloques de comentario (otra estructura frecuente)
        if (comments.length === 0) {
          const blocks = Array.from(document.querySelectorAll('div.C4VMK'));
          for (const b of blocks) {
            try {
              const user = (b.querySelector('h2, a')?.textContent || '').trim();
              const text = (b.querySelector('span')?.textContent || '').trim();
              if (user && text) comments.push({ user, text });
            } catch (e) {}
          }
        }

        // Estrategia 3: si aÃºn vacÃ­o, intentar extraer primer comentario visible mediante un patrÃ³n general
        if (comments.length === 0) {
          const possible = Array.from(document.querySelectorAll('article span'))
            .map(s => (s.textContent || '').trim())
            .filter(Boolean);
          if (possible.length >= 2) {
            // asumimos que el primero puede ser usuario y el segundo su comentario
            comments.push({ user: possible[0], text: possible[1] });
          }
        }

        return { description, date, likes, comments };
      });

      // obtener lista de personas que dieron like
      let likers = [];
      // almacenar comentarios capturados desde respuestas de red
      let commentsAPI = [];
      try {
        await new Promise(r => setTimeout(r, 2000));

        // Interceptar respuestas GraphQL para capturar likers y comentarios via API
        const likersAPI = [];
        const onResponse = async (resp) => {
          try {
            const url = resp.url();
            if (!url.includes('instagram.com')) return;
            const ct = resp.headers()['content-type'] || '';
            if (!ct.includes('json')) return;
            
            // Capturar datos de los endpoints de likers y friendships
            const isLikersApi = url.includes('/api/v1/media/') && url.includes('/likers/');
            const isFriendshipApi = url.includes('/api/v1/friendships/show_many/');
            
            const txt = await resp.text();
            if (!txt.includes('edge_liked_by') && !txt.includes('username') && !isLikersApi && !isFriendshipApi) return;
            
            const data = JSON.parse(txt);

            // 1. Extraer de estructura GraphQL tradicional (edges)
            const edges =
              data?.data?.shortcode_media?.edge_liked_by?.edges ||
              data?.data?.xdt_shortcode_media?.edge_liked_by?.edges ||
              data?.edge_liked_by?.edges || [];

            for (const e of edges) {
              const u = e?.node?.username;
              if (u && !likersAPI.includes(u)) likersAPI.push(u);
            }

            // 2. Extraer del endpoint de API v1 likers (proporcionado por el usuario)
            if (data?.users && Array.isArray(data.users)) {
              for (const user of data.users) {
                if (user.username && !likersAPI.includes(user.username)) {
                  likersAPI.push(user.username);
                }
              }
            }

            // 3. Extraer comentarios desde GraphQL/api v1
            // GraphQL: edge_media_to_parent_comment
            const commentEdges =
              data?.data?.shortcode_media?.edge_media_to_parent_comment?.edges ||
              data?.data?.xdt_shortcode_media?.edge_media_to_parent_comment?.edges ||
              data?.edge_media_to_parent_comment?.edges || [];
            for (const ce of commentEdges) {
              const node = ce?.node;
              if (node) {
                const username = node?.owner?.username || node?.owner?.id || null;
                const text = node?.text || node?.comment_text || null;
                if (username && text) {
                  const entry = `${username}: ${text}`;
                  if (!commentsAPI.includes(entry)) commentsAPI.push(entry);
                }
              }
            }

            // API v1 comments (array 'comments')
            if (data?.comments && Array.isArray(data.comments)) {
              for (const c of data.comments) {
                const username = c.user?.username || c.user?.pk || null;
                const text = c.text || c.comment_text || null;
                if (username && text) {
                  const entry = `${username}: ${text}`;
                  if (!commentsAPI.includes(entry)) commentsAPI.push(entry);
                }
              }
            }
          } catch {}
        };
        page.on('response', onResponse);

        let clicked = false;
        console.log('ðŸ”Ž Buscando el botÃ³n de likes (probando estructura del nÃºmero e Ã­cono)...');
        
        try {
          clicked = await page.evaluate(() => {
            // Buscamos cualquier enlace (a) cuyo contenido parezca la cantidad de likes ("22", "22 me gusta", etc)
            // especialmente si estÃ¡ cerca del SVG del corazÃ³n.
            const links = Array.from(document.querySelectorAll('a[role="link"], span[role="button"]'));
            for(const lk of links) {
              const txt = lk.innerText?.trim();
              if (/^[\d,.]+(\s*(likes?|me\sgusta))?$/i.test(txt) && txt.length > 0 && txt.length < 20) {
                lk.click();
                return true;
              }
            }
            
            // Alternativa: Si existe el enlace directo (casi no se usa ahora en IG pero puede pasar)
            const lks = document.querySelectorAll('a[href*="/liked_by/"]');
            if (lks && lks.length > 0) { lks[0].click(); return true; }
            
            return false;
          });
          if (clicked) {
            console.log('âœ… Clic realizado en el nÃºmero de likes.');
          } else {
            console.log('âš ï¸ No se encontrÃ³ un nÃºmero o enlace obvio para los likes. Se intentarÃ¡ forzar el click en cualquier contador.');
            // Otra heurÃ­stica
            clicked = await page.evaluate(() => {
               const allSpans = document.querySelectorAll('span');
               for(const sp of Array.from(allSpans)) {
                  const text = sp.innerText?.trim();
                  // Si vemos un span en bold/semibold con sÃ³lo un nÃºmero
                  const fw = window.getComputedStyle(sp).fontWeight;
                  if ((fw === 'bold' || fw >= '600') && /^[\d,.]+$/.test(text) && text.length > 0) {
                      sp.click();
                      return true;
                  }
               }
               return false;
            });
            if (clicked) console.log('âœ… Clic de fallback realizado.');
          }
        } catch(e) {
          console.log(`âš ï¸ Error al intentar clickear el corazÃ³n/nÃºmero: ${e.message}`);
        }

        if (clicked) {
          let dialog = null;
          console.log('ðŸ•’ Esperando a que aparezca la ventana emergente de likes...');
          try {
            dialog = await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
            console.log('âœ… Ventana emergente de likes detectada.');
          } catch {
            try {
              dialog = await page.waitForSelector('[aria-label*="ike"], [aria-label*="usta"]', { timeout: 3000 });
              console.log('âœ… Ventana emergente detectada (por aria-label).');
            } catch {
              console.log('âš ï¸ No se detectÃ³ la ventana emergente despuÃ©s del clic.');
            }
          }

          if (dialog) {
            await new Promise(r => setTimeout(r, 2000));

            // Intentar encontrar el contenedor scrolleable dentro del diÃ¡logo
            // SegÃºn el HTML proporcionado, es un div con overflow: hidden auto o similar
            const scrollContainer = await page.evaluateHandle(() => {
                const dialog = document.querySelector('div[role="dialog"]');
                if (!dialog) return null;
                // Buscar un elemento con overflow auto o scroll
                const allDivs = Array.from(dialog.querySelectorAll('div'));
                return allDivs.find(d => {
                    const style = window.getComputedStyle(d);
                    return style.overflowY === 'auto' || style.overflowY === 'scroll';
                }) || dialog;
            });

            // Scrollear hasta 50 veces con deteccion de estancamiento y comportamiento humano
            let stalls = 0;
            let lastLikersCount = 0;
            
            for (let s = 0; s < 50; s++) {
              if (Math.random() > 0.7) await humanMouseMove(page);
              
              await page.evaluate(el => {
                if (el) {
                    const scrollAmount = Math.floor(Math.random() * 500) + 200;
                    el.scrollBy(0, scrollAmount);
                }
              }, scrollContainer);
              
              await delay(1200 + Math.random() * 800);
              
              // Contar los likers actuales en el DOM para verificar si sigue cargando
              const currentCount = await page.evaluate(() => {
                return document.querySelectorAll('div[role="dialog"] span._ap3a._aaco._aacw._aacx._aad7._aade').length;
              });

              if (currentCount === lastLikersCount) {
                stalls++;
                if (stalls >= 4) break;
              } else {
                stalls = 0;
                lastLikersCount = currentCount;
              }
              console.log(`ðŸ“‘ Scrolleando... detectados ~${currentCount} likes en DOM (${likersAPI.length} en API)`);
            }

            console.log('âœ… Scrolling completado o se llegÃ³ al final. Extrayendo usuarios...');

            // Extraer del DOM usando los selectores especÃ­ficos del HTML compartido
            // El nombre de usuario estÃ¡ en <span class="_ap3a _aaco _aacw _aacx _aad7 _aade" dir="auto">...</span>
            let domLikers = await page.$$eval(
              'div[role="dialog"] span._ap3a._aaco._aacw._aacx._aad7._aade',
              ns => ns.map(n => n.textContent?.trim()).filter(Boolean)
            );
            console.log(`ðŸ“‘ Likes detectados mediante el DOM directo: ${domLikers.length}`);

            // Fallbacks si el selector fallara
            if (domLikers.length === 0) {
              domLikers = await page.$$eval(
                'div[role="dialog"] span[dir="auto"]',
                ns => ns.map(n => n.textContent?.trim()).filter(Boolean)
              );
            }
            if (domLikers.length === 0) {
              domLikers = await page.$$eval(
                'div[role="dialog"] a[role="link"]',
                ns => ns.map(n => n.textContent?.trim()).filter(Boolean)
              );
            }

            // Extraer posibles usernames desde enlaces (href => /username/)
            const anchorUsernames = await page.$$eval('div[role="dialog"] a[href]', (as) => {
              return as
                .map(a => {
                  try {
                    const href = a.getAttribute('href') || a.href || '';
                    // normalizar y extraer la parte de username
                    const m = href.match(/\/([^\/]+)\/?$/);
                    if (m) return decodeURIComponent(m[1]);
                  } catch (e) {}
                  return null;
                })
                .filter(Boolean);
            });

            // Combinar API + DOM + anchors y limpiar
            let combined = [...new Set([...likersAPI, ...domLikers, ...anchorUsernames])]
              .filter(l => l && l.length > 1 && !/^(seguir|follow|unfollow|remove|cancelar|verified|Seguir)$/i.test(l));

            // Si tenemos un conteo esperado de likes, intentar scrollear mÃ¡s si faltan perfiles
            const expectedCount = (() => {
              try {
                const m = (info.likes || '').toString().match(/(\d[\d.,]*)/);
                if (m) return parseInt(m[1].replace(/[.,]/g, ''));
              } catch (e) {}
              return NaN;
            })();

            if (!Number.isNaN(expectedCount) && combined.length < expectedCount) {
              console.log(`🔎 Esperado ${expectedCount} likes, encontrados ${combined.length}. Realizando scrolleo extra...`);
              let extraStalls = 0;
              for (let t = 0; t < 20; t++) {
                if (Math.random() > 0.6) await humanMouseMove(page);
                await page.evaluate(el => el.scrollBy(0, 500), scrollContainer);
                await delay(1500 + Math.random() * 500);
                // reextraer
                const domNow = await page.$$eval('div[role="dialog"] span._ap3a._aaco._aacw._aacx._aad7._aade', ns => ns.map(n => n.textContent?.trim()).filter(Boolean));
                const anchorsNow = await page.$$eval('div[role="dialog"] a[href]', (as) => as.map(a => { try { const m = (a.getAttribute('href')||'').match(/\/([^\/]+)\/?$/); return m?decodeURIComponent(m[1]):null;}catch(e){}return null; }).filter(Boolean));
                const prevLen = combined.length;
                combined = [...new Set([...combined, ...domNow, ...anchorsNow])].filter(l => l && l.length > 1);
                if (combined.length === prevLen) {
                  extraStalls++;
                  if (extraStalls >= 4) break;
                } else {
                  extraStalls = 0;
                }
                console.log(`ðŸ“‘ Re-scrolleando... ahora ~${combined.length}`);
                if (combined.length >= expectedCount) break;
              }
            }

            likers = combined;

            console.log('Extraidos ' + likers.length + ' perfiles que dieron like.');
            await page.keyboard.press('Escape');
            await new Promise(r => setTimeout(r, 1000));
          } else {
            likers = [...likersAPI];
            console.log('Extraidos ' + likers.length + ' perfiles (API) que dieron like.');
          }
        } else {
          console.log('No se encontro el boton de likes para hacer clic.');
        }
        page.off('response', onResponse);
      } catch (e) {
        console.log('No se pudo extraer la lista de personas que dieron like: ' + e.message);
        likers = [];
      }

            // asegurar formato: si vacÃ­o usar 'No disponible'
            if (!info.description) info.description = 'No disponible';
            if (!info.date) info.date = 'No disponible';
            if (!info.likes) info.likes = 'No disponible';
            if (!Array.isArray(info.comments)) info.comments = [];

            // Combinar comentarios detectados en la pÃ¡gina con los capturados por la API
            const commentsFromInfo = (info.comments || []).map(c => ({ user: c.user || (c.user||''), text: c.text || (typeof c === 'string' ? c : '') }));
            const commentsFromAPI = (commentsAPI || []).map(s => {
              const ix = s.indexOf(':');
              if (ix > 0) return { user: s.slice(0, ix).trim(), text: s.slice(ix + 1).trim() };
              return { user: '', text: s };
            });
            // merge unique by 'user: text'
            const mergedCommentsMap = new Map();
            for (const c of [...commentsFromInfo, ...commentsFromAPI]) {
              const key = (c.user || '') + '::' + (c.text || '');
              if (!mergedCommentsMap.has(key)) mergedCommentsMap.set(key, c);
            }
            const mergedComments = Array.from(mergedCommentsMap.values());

            postsData.push({ url: postUrl, ...info, likers: likers.length ? likers : ['No disponible'], comments: mergedComments });
      console.log(`âœ… PublicaciÃ³n ${idx + 1} procesada.`);
    } catch (err) {
      console.log(`âš ï¸ Error procesando publicaciÃ³n ${idx + 1}: ${err.message}`);
      postsData.push({ url: postUrl, description: 'No disponible', date: 'No disponible', likes: 'No disponible', likers: ['No disponible'], comments: [] });
    }
  }

  // --- GENERAR CSV ---
  console.log('📝 Generando reporte CSV...');
  const csvData = postsData.slice(0, MAX_POSTS).map((p, i) => {
    let likersStr = 'No disponible';
    if (p.likers && p.likers.length > 0) likersStr = p.likers.join(' | ');
    let commentsStr = 'No tiene';
    if (p.comments && p.comments.length > 0) {
      commentsStr = p.comments.map(c => `${c.user}: ${c.text}`).join(' | ');
    } else {
      // Si no hay texto de comentario pero la descripcion indica un comentario, anotar que existe
      try {
        const m = (p.description || '').toString().match(/(\d+)\s+comments?/i);
        if (m && parseInt(m[1], 10) > 0) {
          commentsStr = `Tiene ${m[1]} comentario${m[1] === '1' ? '' : 's'}`;
        }
      } catch (e) {}
    }

    return {
      'Publicacion': 'Publicacion ' + (i + 1),
      'URL': p.url,
      'Descripcion': p.description || 'No disponible',
      'Fecha': p.date || 'No disponible',
      'Cantidad de likes': p.likes || 'No disponible',
      'Personas que dieron like': likersStr,
      'Comentarios': commentsStr
    };
  });

  try {
    const csvContent = parse(csvData);
    fs.writeFileSync('reporte_publicaciones.csv', '\uFEFF' + csvContent, 'utf-8');
    console.log('✅ Reporte CSV guardado como reporte_publicaciones.csv');
  } catch (e) {
    console.log('⚠️ Error generando CSV: ', e);
  }

  await browser.close();
})();
