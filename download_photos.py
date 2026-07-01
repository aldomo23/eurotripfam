#!/usr/bin/env python3
"""
download_photos.py — Descarga fotos de Pexels y las convierte a WebP
                     para la Guía Europa 2026.

INSTRUCCIONES:
1. Instalar dependencias:
   pip install requests Pillow

2. Obtener tu API key de Pexels (gratis, 2 minutos):
   - Ve a https://www.pexels.com/api/new/
   - Crea cuenta (o login con Google)
   - Copia tu API key

3. Correr el script:
   python download_photos.py TU_API_KEY

4. Las fotos se guardan en img/places/ listas para hacer push a GitHub.
5. Los JSONs se actualizan automáticamente con las rutas correctas.

NOTAS:
- Descarga 68 fotos (~5 minutos con buena conexión)
- Si una foto no te gusta, reemplázala manualmente en img/places/
  con cualquier foto .webp del mismo nombre
- Las fotos de comida a veces dan resultados genéricos;
  revisa esas 7 al final
"""

import sys
import os
import json
import time

try:
    import requests
    from PIL import Image
    from io import BytesIO
except ImportError:
    print("❌ Faltan dependencias. Instálalas con:")
    print("   pip install requests Pillow")
    sys.exit(1)

# --- Configuración ---
OUTPUT_DIR = "img/places"
TARGET_WIDTH = 800
WEBP_QUALITY = 78  # Balance entre calidad y peso (~50-100KB)

# --- Manifiesto de fotos (id → término de búsqueda en Pexels) ---
PHOTO_MANIFEST = {
    "sagrada-familia": "sagrada familia barcelona interior",
    "park-guell": "park guell barcelona mosaic",
    "casa-batllo": "casa batllo barcelona facade",
    "la-pedrera": "casa mila la pedrera barcelona",
    "palau-musica-catalana": "palau musica catalana barcelona",
    "hospital-sant-pau": "hospital sant pau barcelona modernisme",
    "casa-amatller": "casa amatller barcelona",
    "torre-glories": "torre glories barcelona agbar",
    "barrio-gotico": "barrio gotico barcelona cathedral",
    "el-born": "el born barcelona santa maria del mar",
    "plaza-real": "plaza real barcelona",
    "las-ramblas": "las ramblas barcelona",
    "plaza-sant-felip-neri": "plaza sant felip neri barcelona",
    "muhba-subsuelo-romano": "muhba roman ruins barcelona",
    "museo-picasso": "museu picasso barcelona",
    "mnac": "mnac barcelona national art museum",
    "fundacio-miro": "fundacio joan miro barcelona",
    "macba": "macba barcelona contemporary art",
    "cccb": "cccb barcelona",
    "museu-disseny": "museu del disseny barcelona",
    "parc-ciutadella": "parc de la ciutadella barcelona fountain",
    "labyrinth-park-horta": "laberint horta barcelona labyrinth",
    "parc-guinardo": "parc del guinardo barcelona view",
    "carretera-aigues": "carretera de les aigues barcelona hiking",
    "tibidabo-collserola": "tibidabo barcelona",
    "bunkeres-carmel": "bunkers del carmel barcelona panoramic",
    "montjuic-castillo-font-magica": "montjuic castle barcelona magic fountain",
    "playa-barceloneta-bogatell": "barceloneta beach barcelona",
    "la-boqueria": "la boqueria market barcelona",
    "mercat-sant-antoni": "mercat sant antoni barcelona",
    "mercat-santa-caterina": "mercat santa caterina barcelona roof",
    "barrio-gracia": "gracia neighborhood barcelona",
    "poble-sec-carrer-blai": "poble sec carrer blai barcelona tapas",
    "sant-pere-entorno": "sant pere barrio barcelona",
    "escapada-sitges": "sitges beach town spain",
    "escapada-montserrat": "montserrat monastery mountain spain",
    "escapada-girona": "girona colorful houses onyar river",
    "escapada-costa-brava-tossa": "tossa de mar costa brava castle",
    "escapada-figueres-dali": "dali museum figueres spain",
    "coliseo": "colosseum rome",
    "foro-romano": "roman forum rome ruins",
    "basilica-san-pedro": "st peters basilica vatican rome",
    "fontana-di-trevi": "trevi fountain rome",
    "panteon": "pantheon rome interior",
    "museos-vaticanos": "vatican museums sistine chapel",
    "piazza-navona": "piazza navona rome fountain",
    "campo-de-fiori": "campo de fiori rome market",
    "castel-sant-angelo": "castel sant angelo rome",
    "trastevere": "trastevere rome streets",
    "aventino": "aventine hill rome orange garden",
    "florencia-dos-dias": "florence duomo brunelleschi aerial",
    "torre-eiffel": "eiffel tower paris",
    "musee-dorsay": "musee dorsay paris clock",
    "louvre": "louvre museum paris pyramid",
    "notre-dame-paris": "notre dame paris cathedral",
    "sainte-chapelle": "sainte chapelle paris stained glass",
    "montmartre-sacre-coeur": "sacre coeur montmartre paris",
    "marais-place-des-vosges": "place des vosges paris marais",
    "crucero-sena": "seine river cruise paris",
    "versalles": "versailles palace hall mirrors",
    "palais-royal": "palais royal paris garden",
    "pa-amb-tomaquet": "pan con tomate spanish bread tomato",
    "crema-catalana": "crema catalana dessert caramel",
    "xuixos": "xuixo pastry cream catalan",
    "churros-chocolate": "churros chocolate spain",
    "fideuà": "fideua spanish noodle paella",
    "vermut-catalan": "vermouth spain bar tapas",
    "calcots": "calcots catalan grilled onions",
}

# Fallbacks: si Pexels no encuentra la foto específica, intenta con estos términos
FALLBACKS = {
    "casa-amatller": "barcelona modernist building",
    "muhba-subsuelo-romano": "ancient roman ruins underground",
    "cccb": "barcelona contemporary art center",
    "museu-disseny": "barcelona design museum modern",
    "carretera-aigues": "barcelona mountain trail hiking view",
    "sant-pere-entorno": "barcelona old town narrow streets",
    "escapada-figueres-dali": "salvador dali museum surreal",
    "xuixos": "cream filled pastry fried",
    "calcots": "grilled green onions spanish",
    "palau-musica-catalana": "stained glass concert hall ornate",
    "hospital-sant-pau": "art nouveau hospital barcelona",
}


def search_pexels(query, api_key):
    """Busca una foto en Pexels y devuelve la URL de descarga."""
    headers = {"Authorization": api_key}
    params = {"query": query, "per_page": 1, "orientation": "landscape"}
    
    url = "https://api.pexels.com/v1/search"
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    
    if resp.status_code == 429:
        print("    ⏳ Rate limit alcanzado, esperando 60 segundos...")
        time.sleep(60)
        resp = requests.get(url, headers=headers, params=params, timeout=15)
    
    if resp.status_code != 200:
        return None
    
    data = resp.json()
    if not data.get("photos"):
        return None
    
    # Usar la versión "large" (~940px ancho)
    return data["photos"][0]["src"]["large"]


def download_and_convert(url, output_path):
    """Descarga una imagen y la convierte a WebP optimizado."""
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        return False
    
    img = Image.open(BytesIO(resp.content))
    
    # Convertir a RGB si es RGBA o P
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    
    # Redimensionar a TARGET_WIDTH manteniendo proporción
    w, h = img.size
    if w > TARGET_WIDTH:
        ratio = TARGET_WIDTH / w
        new_h = int(h * ratio)
        img = img.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
    
    # Guardar como WebP
    img.save(output_path, "WEBP", quality=WEBP_QUALITY, method=6)
    
    # Verificar peso
    size_kb = os.path.getsize(output_path) / 1024
    return size_kb


def update_jsons():
    """Actualiza los campos photo en todos los JSONs."""
    json_files = {
        "data/places-barcelona.json": "places",
        "data/places-roma.json": "places",
        "data/places-florencia.json": "places",
        "data/places-paris.json": "places",
        "data/food-barcelona.json": "food",
    }
    
    updated_count = 0
    
    for filepath, file_type in json_files.items():
        if not os.path.exists(filepath):
            print(f"  ⚠️ Archivo no encontrado: {filepath}")
            continue
        
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        modified = False
        for item in data:
            photo_id = item["id"]
            webp_path = f"img/places/{photo_id}.webp"
            
            if os.path.exists(webp_path):
                item["photo"] = webp_path
                modified = True
                updated_count += 1
            
            # Asegurar que gallery existe como array vacío
            if "gallery" not in item:
                item["gallery"] = []
                modified = True
        
        if modified:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"  ✅ {filepath} actualizado")
    
    return updated_count


def main():
    if len(sys.argv) < 2:
        print("❌ Falta la API key de Pexels.")
        print("")
        print("Uso: python download_photos.py TU_API_KEY")
        print("")
        print("Obtén tu API key gratis en: https://www.pexels.com/api/new/")
        sys.exit(1)
    
    api_key = sys.argv[1]
    
    # Crear directorio de salida
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    total = len(PHOTO_MANIFEST)
    downloaded = 0
    failed = []
    
    print(f"📷 Descargando {total} fotos de Pexels...")
    print(f"   Destino: {OUTPUT_DIR}/")
    print(f"   Formato: WebP, {TARGET_WIDTH}px ancho, ~50-100KB")
    print("")
    
    for i, (photo_id, query) in enumerate(PHOTO_MANIFEST.items(), 1):
        output_path = os.path.join(OUTPUT_DIR, f"{photo_id}.webp")
        
        # Saltar si ya existe
        if os.path.exists(output_path):
            print(f"  [{i}/{total}] ⏭️  {photo_id}.webp (ya existe)")
            downloaded += 1
            continue
        
        print(f"  [{i}/{total}] 🔍 Buscando: \"{query}\"...", end=" ", flush=True)
        
        # Buscar en Pexels
        img_url = search_pexels(query, api_key)
        
        # Si no encuentra, intentar fallback
        if not img_url and photo_id in FALLBACKS:
            fallback_query = FALLBACKS[photo_id]
            print(f"(fallback: \"{fallback_query}\")...", end=" ", flush=True)
            img_url = search_pexels(fallback_query, api_key)
        
        if not img_url:
            print("❌ No encontrada")
            failed.append(photo_id)
            continue
        
        # Descargar y convertir
        size_kb = download_and_convert(img_url, output_path)
        if size_kb:
            print(f"✅ {size_kb:.0f}KB")
            downloaded += 1
        else:
            print("❌ Error al descargar")
            failed.append(photo_id)
        
        # Pausa para no exceder rate limit (200/hora)
        time.sleep(0.5)
    
    # Resumen
    print("")
    print("=" * 50)
    print(f"📊 Resultado: {downloaded}/{total} fotos descargadas")
    
    if failed:
        print(f"❌ Fallaron {len(failed)}:")
        for f in failed:
            print(f"   - {f}")
        print("")
        print("   Para estas, descarga manualmente de Unsplash o Pexels")
        print("   y guárdalas como img/places/NOMBRE.webp")
    
    # Actualizar JSONs
    print("")
    print("📝 Actualizando JSONs con rutas de fotos...")
    updated = update_jsons()
    print(f"   {updated} fichas actualizadas")
    
    # Verificar peso total
    total_size = 0
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.webp'):
            total_size += os.path.getsize(os.path.join(OUTPUT_DIR, f))
    print(f"\n📦 Peso total de fotos: {total_size / 1024 / 1024:.1f} MB")
    
    print("")
    print("✅ ¡Listo! Ahora:")
    print("   1. Revisa las fotos en img/places/")
    print("   2. Reemplaza las que no te gusten")
    print("   3. git add . && git commit -m 'feat: fotos de lugares' && git push")


if __name__ == "__main__":
    main()
