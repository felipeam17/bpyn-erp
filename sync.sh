#!/bin/bash
DOWNLOADS=~/Downloads
PROJECT=~/Desktop/byn-erp

[ -f "$DOWNLOADS/Tasks.jsx" ]       && cp "$DOWNLOADS/Tasks.jsx"       "$PROJECT/src/pages/Tasks.jsx"       && echo "✓ Tasks.jsx"
[ -f "$DOWNLOADS/Suppliers.jsx" ]   && cp "$DOWNLOADS/Suppliers.jsx"   "$PROJECT/src/pages/Suppliers.jsx"   && echo "✓ Suppliers.jsx"
[ -f "$DOWNLOADS/Catalog.jsx" ]     && cp "$DOWNLOADS/Catalog.jsx"     "$PROJECT/src/pages/Catalog.jsx"     && echo "✓ Catalog.jsx"
[ -f "$DOWNLOADS/Quotes.jsx" ]      && cp "$DOWNLOADS/Quotes.jsx"      "$PROJECT/src/pages/Quotes.jsx"      && echo "✓ Quotes.jsx"
[ -f "$DOWNLOADS/NewQuote.jsx" ]    && cp "$DOWNLOADS/NewQuote.jsx"    "$PROJECT/src/pages/NewQuote.jsx"    && echo "✓ NewQuote.jsx"
[ -f "$DOWNLOADS/Dashboard.jsx" ]   && cp "$DOWNLOADS/Dashboard.jsx"   "$PROJECT/src/pages/Dashboard.jsx"   && echo "✓ Dashboard.jsx"
[ -f "$DOWNLOADS/App.jsx" ]         && cp "$DOWNLOADS/App.jsx"         "$PROJECT/src/App.jsx"               && echo "✓ App.jsx"
[ -f "$DOWNLOADS/Layout.jsx" ]      && cp "$DOWNLOADS/Layout.jsx"      "$PROJECT/src/components/Layout.jsx" && echo "✓ Layout.jsx"
[ -f "$DOWNLOADS/supabase.js" ]     && cp "$DOWNLOADS/supabase.js"     "$PROJECT/src/lib/supabase.js"       && echo "✓ supabase.js"
[ -f "$DOWNLOADS/export-quote.js" ] && cp "$DOWNLOADS/export-quote.js" "$PROJECT/api/export-quote.js"       && echo "✓ export-quote.js"
[ -f "$DOWNLOADS/index.css" ]       && cp "$DOWNLOADS/index.css"       "$PROJECT/src/index.css"             && echo "✓ index.css"

cd "$PROJECT" && git add . && git commit -m "sync: update files" && git push
