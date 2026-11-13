/* Mom's Kitchen website: the recipe box, family recipes, the meal planner and the shopping list. */
(function () {
  var book = window.COOKBOOK;
  /* The Searchlight recipes (searchlight.js) are a separate collection, shown in blue plaid. */
  var searchlight = window.SEARCHLIGHT || { types: [], recipes: [] };
  searchlight.types.forEach(function (t) {
    if (!book.types.some(function (x) { return x.id === t.id; })) book.types.push(t);
  });
  var $ = function (id) { return document.getElementById(id); };
  var typeTitle = {};
  book.types.forEach(function (t) { typeTitle[t.id] = t.title; });

  var PLATE =
    '<svg viewBox="0 0 120 120" aria-hidden="true">' +
    '<circle cx="60" cy="60" r="52" fill="#fff" stroke="#9b3b2e" stroke-width="3"/>' +
    '<circle cx="60" cy="60" r="38" fill="none" stroke="#d9cbbd" stroke-width="2" stroke-dasharray="3 5"/>' +
    '<path d="M60 40c-11 0-19 7-19 16h38c0-9-8-16-19-16z" fill="#9b3b2e"/>' +
    '<rect x="36" y="58" width="48" height="5" rx="2.5" fill="#9b3b2e"/>' +
    '<circle cx="60" cy="37" r="3" fill="#9b3b2e"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* Lower-case, no accents, straight quotes: "Étouffée" finds "etouffee". */
  function plain(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'").toLowerCase();
  }
  /* "tomatoes" should also find "tomato", "cherries" find "cherry". */
  function stem(word) {
    if (word.length > 4 && /ies$/.test(word)) return word.slice(0, -3);
    if (word.length > 4 && /oes$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && /s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
    return word;
  }
  /* Mom's recipes are No. 1, 2, 3… as in the book; family recipes are F1, F2…; Searchlight S1, S2… */
  function numberOf(r) {
    return r.number == null ? "" : (r.family ? "F" : r.searchlight ? "S" : "") + r.number;
  }
  function kitchenOf(r) {
    return r.family ? (r.credit || "the family") : r.searchlight ? "the Household Searchlight" : "Novella";
  }
  function collectionClass(r) {
    return r.family ? " family" : r.searchlight ? " searchlight" : "";
  }
  function numberTag(r) {
    return numberOf(r) ? '<span class="recipe-no">No. ' + numberOf(r) + "</span>" : "";
  }
  function picture(r, alt) {
    return r.image ? '<img src="' + esc(r.image) + '" alt="' + esc(alt) + '" loading="lazy">'
                   : '<div class="no-pic">' + PLATE + "</div>";
  }
  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem("momsKitchen." + key));
      localStorage.setItem("momsKitchen." + key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  /* ---------- Which meals a recipe suits (for the planner) ---------- */
  var MORNING = /breakfast|griddle|doughnut|scone|popover|coffee cake|braid|egg casserole|pancake|waffle|muffin|french toast|biscuit|omelet|granola|oatmeal|quiche|danish|cinnamon roll/i;
  function mealsOf(r) {
    if (r.family && r.meal && r.meal.length) return r.meal;
    if (r.type === "breakfast") return MORNING.test(r.title) ? ["breakfast"] : ["lunch"];
    if (r.type === "sides") return /dressing/i.test(r.title) ? [] : ["side"];
    if (r.type === "cookies" || r.type === "cakes-pies" || r.type === "desserts") return ["dessert"];
    if (r.type === "breads") return MORNING.test(r.title) ? ["breakfast"] : ["side"];
    if (r.type === "appetizers" || r.type === "canning") return [];
    return ["lunch", "dinner"];
  }
  var MEAL_NAME = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", side: "Side dish", dessert: "Dessert" };
  var TYPE_MEALS = {};       // a sensible default for the "Good for" boxes when a type is chosen
  book.types.forEach(function (t) { TYPE_MEALS[t.id] = mealsOf({ type: t.id, title: "" }); });
  TYPE_MEALS.breakfast = ["breakfast", "lunch"];

  /* ---------- All recipes: Mom's book plus the family library ---------- */
  var recipes = [];
  var family = [];
  var familyOnline = false;

  function prepare(r) {
    r._name = plain(r.title);
    r._ingredients = plain(r.ingredients.map(function (g) { return g.items.join("\n"); }).join("\n"));
    r._meals = mealsOf(r);
    return r;
  }
  book.recipes.forEach(prepare);
  searchlight.recipes.forEach(function (r) {
    r.searchlight = true;
    r.tried = false;
    r.notes = r.notes || [];
    r.times = r.times || {};
    prepare(r);
  });
  function rebuild() {
    recipes = book.recipes.concat(searchlight.recipes, family).sort(function (a, b) { return a._name < b._name ? -1 : 1; });
  }
  function byId(id) { return recipes.find(function (x) { return x.id === id; }); }

  function loadFamily() {
    return fetch("api/family", { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (list) {
        familyOnline = true;
        family = list.map(function (r) {
          r.family = true;
          r.tried = false;
          r.ingredients = r.ingredients || [];
          r.steps = r.steps || [];
          r.notes = r.notes || [];
          r.times = r.times || {};
          return prepare(r);
        });
      })
      .catch(function () { familyOnline = false; family = []; })
      .then(rebuild);
  }
  rebuild();

  /* Pictures made for Searchlight recipes are kept by serve.py in searchlight-img/. */
  var picturesOnline = false;
  function loadPictures() {
    return fetch("api/searchlight-images", { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (index) {
        picturesOnline = true;
        searchlight.recipes.forEach(function (r) { if (index[r.id]) r.image = index[r.id]; });
      })
      .catch(function () {
        /* No serve.py (the GitHub copy): show the pictures already made, but no button. */
        picturesOnline = false;
        return fetch("searchlight-img/index.json", { cache: "no-store" })
          .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
          .then(function (index) {
            searchlight.recipes.forEach(function (r) { if (index[r.id]) r.image = index[r.id]; });
          })
          .catch(function () {});
      });
  }

  /* ---------- Nutrition filters ---------- */
  var NUTRIENTS = [
    ["calories", "Calories", ""], ["protein", "Protein", "g"], ["fat", "Fat", "g"],
    ["carbs", "Carbs", "g"], ["sugar", "Sugar", "g"], ["sodium", "Sodium", "mg"],
  ];
  var PRESETS = {
    protein: { label: "High protein (over 16 g)", test: function (n) { return n.protein > 16; } },
    lowfat: { label: "Low fat (10 g or less)", test: function (n) { return n.fat <= 10; } },
    lowsugar: { label: "Low sugar (5 g or less)", test: function (n) { return n.sugar != null && n.sugar <= 5; } },
  };

  /* A nutrition dropdown plus its "define your own" panel; returns a reader for the choice. */
  function nutritionFilter(select, panel, onChange) {
    select.innerHTML = '<option value="">Any nutrition</option>' +
      Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + PRESETS[k].label + "</option>"; }).join("") +
      '<option value="custom">Define your own&hellip;</option>';
    panel.innerHTML = '<p class="custom-head">Per serving &mdash; fill in any of these:</p><div class="custom-grid">' +
      NUTRIENTS.map(function (n) {
        var unit = n[2] ? " (" + n[2] + ")" : "";
        return '<div class="range"><span>' + n[1] + unit + "</span>" +
          '<input type="number" min="0" inputmode="numeric" data-k="' + n[0] + '" data-side="min" placeholder="at least">' +
          '<input type="number" min="0" inputmode="numeric" data-k="' + n[0] + '" data-side="max" placeholder="at most"></div>';
      }).join("") + "</div>";
    select.addEventListener("change", function () {
      panel.hidden = select.value !== "custom";
      onChange();
    });
    panel.addEventListener("input", onChange);
    return function () {
      var choice = { preset: select.value, ranges: [] };
      if (choice.preset === "custom") {
        panel.querySelectorAll("input").forEach(function (i) {
          if (i.value !== "") choice.ranges.push({ k: i.dataset.k, side: i.dataset.side, v: +i.value });
        });
      }
      return choice;
    };
  }
  function nutritionOk(r, choice) {
    if (!choice || !choice.preset || (choice.preset === "custom" && !choice.ranges.length)) return true;
    var n = r.nutrition;
    if (!n) return false;
    if (PRESETS[choice.preset]) return PRESETS[choice.preset].test(n);
    return choice.ranges.every(function (x) {
      var v = n[x.k];
      if (v == null || v === "") return false;
      return x.side === "min" ? v >= x.v : v <= x.v;
    });
  }

  /* Every search tool uses this: name, ingredient, type, nutrition, library, tried & true. */
  function matches(r, f) {
    var asNumber = f.name && f.name.match(/^(?:no\.?\s*|#)?([fs]?)\s*(\d+)$/);     // "12", "#12", "no. 12", "f3", "s7"
    if (asNumber) {
      if (String(r.number) !== String(+asNumber[2]) || (asNumber[1] === "f") !== !!r.family ||
          (asNumber[1] === "s") !== !!r.searchlight) return false;
    } else if (f.name && f.name.split(/\s+/).some(function (w) { return r._name.indexOf(stem(w)) < 0; })) return false;
    var wanted = plain(f.ingredient || "").split(/[,;]+| and /).map(function (s) { return s.trim(); }).filter(Boolean);
    if (wanted.some(function (term) {
      return term.split(/\s+/).some(function (w) { return r._ingredients.indexOf(stem(w)) < 0; });
    })) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.library === "book" && (r.family || r.searchlight)) return false;
    if (f.library === "family" && !r.family) return false;
    if (f.library === "searchlight" && !r.searchlight) return false;
    if (f.library === "mine" && r.searchlight) return false;
    if (f.tried && !r.tried) return false;
    return nutritionOk(r, f.nutrition);
  }

  /* ---------- Home ---------- */
  $("portrait").src = book.portrait;
  $("portrait-caption").textContent = book.portraitCaption;
  $("foreword").innerHTML = book.foreword.split("\n\n").map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  $("foreword").classList.add("collapsed");
  $("foreword-toggle").addEventListener("click", function () {
    var open = $("foreword").classList.toggle("collapsed") === false;
    this.textContent = open ? "Show less" : "Read the rest of Mom's story";
  });

  ["q-type", "p-type", "f-type"].forEach(function (id) {
    book.types.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.title;
      $(id).appendChild(o);
    });
  });

  var homeNutrition = nutritionFilter($("q-nutrition"), $("q-custom"), search);
  function homeFilter() {
    return {
      name: plain($("q-name").value).trim(),
      ingredient: $("q-ingredient").value,
      type: $("q-type").value,
      library: $("q-library").value,
      tried: $("q-tried").checked,
      nutrition: homeNutrition(),
    };
  }

  function search() {
    var f = homeFilter();
    var found = recipes.filter(function (r) { return matches(r, f); });
    $("results").innerHTML = found.map(function (r) {
      return '<a class="card' + collectionClass(r) + '" href="#/r/' + r.id + '">' +
        (r.tried ? '<div class="burst"><span>Tried &amp; true</span></div>' : "") +
        (r.family ? '<div class="ribbon">Family recipe</div>' : "") +
        (r.searchlight ? '<div class="ribbon">Searchlight recipe</div>' : "") +
        '<div class="pic">' + picture(r, r.title) + "</div>" +
        '<div class="card-body"><div class="kicker">' + numberTag(r) + esc(typeTitle[r.type] || "") + "</div>" +
        "<h3>" + esc(r.title) + "</h3>" +
        (r.family && r.credit ? '<div class="card-credit">from ' + esc(r.credit) + "</div>" : "") +
        "</div></a>";
    }).join("");
    $("count").textContent = found.length === 1 ? "1 recipe" : found.length + " recipes";
    $("empty").hidden = found.length > 0;
  }

  ["q-name", "q-ingredient"].forEach(function (id) { $(id).addEventListener("input", search); });
  ["q-type", "q-tried", "q-library"].forEach(function (id) { $(id).addEventListener("change", search); });
  $("clear").addEventListener("click", function () {
    $("finder").reset();
    $("q-custom").hidden = true;
    search();
    $("q-name").focus();
  });

  /* ---------- One recipe ---------- */
  function nutritionLine(n) {
    if (!n) return "";
    var parts = [];
    if (n.calories != null) parts.push(n.calories + " calories");
    [["fat", "g fat"], ["carbs", "g carbs"], ["sugar", "g sugar"], ["protein", "g protein"]].forEach(function (x) {
      if (n[x[0]] != null) parts.push(n[x[0]] + " " + x[1]);
    });
    if (n.sodium != null) parts.push(n.sodium.toLocaleString() + " mg sodium");
    if (!parts.length) return "";
    return '<div class="nutrition"><b>Approx. nutrition</b> ' + esc(n.basis || "per serving") + ": " + parts.join(" &middot; ") + "</div>";
  }
  function ingredientList(r) {
    return r.ingredients.map(function (g) {
      return (g.heading ? '<div class="group">' + esc(g.heading) + "</div>" : "") +
        "<ul>" + g.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
    }).join("");
  }

  function showRecipe(r) {
    var html =
      '<div class="recipe-top"><a class="link-button" href="#/">&larr; Back to all recipes</a><span class="top-actions">' +
      (r.family ? '<a class="link-button" href="#/edit/' + r.id + '">Change this recipe</a>' +
                  '<button class="link-button" type="button" id="delete-recipe">Delete</button>' : "") +
      '<button class="link-button" type="button" onclick="window.print()">Print this recipe</button></span></div>' +
      '<div class="recipe-hero">' + picture(r, r.title) + "</div>" +
      (r.searchlight && !r.image && picturesOnline ? pictureMaker() : "") +
      '<div class="recipe-main">' +
      (r.tried ? '<div class="burst"><span>Mom\'s tried &amp; true</span></div>' : "") +
      '<div class="from-kitchen">' + (r.searchlight ? "From the Household Searchlight Recipe Book" :
        "From the kitchen of " + esc(kitchenOf(r))) + "</div>" +
      '<div class="kicker">' + numberTag(r) + (r.family ? "Family recipe &middot; " : "") +
        (r.searchlight ? "Searchlight recipe &middot; " : "") + esc(typeTitle[r.type] || "") + "</div>" +
      "<h1>" + esc(r.title) + "</h1>" +
      (r.blurb ? '<p class="blurb">' + esc(r.blurb) +
        (r.family || r.searchlight || book.signed === false ? "" : ' <span class="signed">&mdash;&nbsp;' + (r.tried ? "David" : "Mom") + "</span>") + "</p>" : "") +
      (r.credit && !r.family ? '<p class="credit">' + esc(r.credit) + "</p>" : "") +
      '<div class="meta">' +
      (r.serves ? "<span><b>Makes</b>" + esc(r.serves) + "</span>" : "") +
      Object.keys(r.times).map(function (k) { return "<span><b>" + esc(k) + "</b>" + esc(r.times[k]) + "</span>"; }).join("") +
      "</div>" +
      '<div class="columns">' +
      (r.ingredients.length ? '<section class="ingredients"><h2>Ingredients</h2>' + ingredientList(r) + "</section>" : "") +
      '<section class="steps"><h2>Directions</h2><ol>' +
      r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
      (r.tip ? '<div class="tip"><b>Tip:</b> ' + esc(r.tip) + "</div>" : "") +
      "</section></div>" +
      r.notes.map(function (t) {
        return '<div class="mom-note"><small>' + (r.family || r.searchlight ? "Note" : "Mom's note") + "</small>" + esc(t) + "</div>";
      }).join("") +
      nutritionLine(r.nutrition) +
      (r.card ? '<figure class="original-card"><figcaption>The original card</figcaption><img src="' + esc(r.card) + '" alt="Scan of the recipe card"></figure>' : "") +
      "</div>";
    $("recipe").innerHTML = html;
    $("recipe").classList.toggle("searchlight", !!r.searchlight);
    document.title = r.title + " – Mom's Kitchen";
    if ($("make-picture")) wirePictureMaker(r);
    if (r.family) {
      $("delete-recipe").addEventListener("click", function () {
        if (!confirm('Delete "' + r.title + '" from the family recipes? This can\'t be undone.')) return;
        fetch("api/family/" + encodeURIComponent(r.id), { method: "DELETE" })
          .then(function (res) { if (!res.ok) throw new Error(); return loadFamily(); })
          .then(function () { search(); location.hash = "#/"; })
          .catch(function () { alert("Couldn't delete it. Is the website running with py serve.py?"); });
      });
    }
  }

  /* ---------- Make a picture for a Searchlight recipe (Venice AI, the person's own key) ----------
     The key is only kept in this page while it is open: it is never saved or sent to our server. */
  var veniceKey = "";
  var VENICE_URL = "https://api.venice.ai/api/v1/image/generate";
  var VENICE_MODEL = "z-image-turbo";
  function pictureMaker() {
    return '<div class="picture-maker" id="picture-maker">' +
      '<button type="button" class="button" id="make-picture">Make a picture of this dish</button>' +
      '<div class="key-box" id="key-box" hidden>' +
      '<label for="venice-key">Your Venice API key</label>' +
      '<input type="password" id="venice-key" autocomplete="off" spellcheck="false" placeholder="Paste your key here">' +
      '<button type="button" class="button" id="use-key">Make the picture</button>' +
      '<p class="fine">The key is only used to ask Venice for this picture. It isn&rsquo;t saved anywhere, and it&rsquo;s forgotten when you close the page.</p>' +
      "</div>" +
      '<p class="picture-status" id="picture-status" role="status"></p></div>';
  }
  function picturePrompt(r) {
    var foods = [];
    r.ingredients.forEach(function (g) { g.items.forEach(function (i) { foods.push(i); }); });
    var list = foods.slice(0, 10).map(function (i) {
      return i.replace(/\(.*?\)/g, "").replace(/^[\d½⅓⅔¼¾⅛\s\/-]+/, "").trim();
    }).filter(Boolean).join(", ");
    return "Appetizing food photograph of \"" + r.title + "\", a homemade American dish from a 1930s farm-kitchen cookbook" +
      (typeTitle[r.type] ? " (" + typeTitle[r.type] + ")" : "") + ". Made with: " + list + ". " +
      "Served on a vintage plate or dish on a wooden kitchen table, soft window light, shallow depth of field, " +
      "realistic, warm and inviting. No text, no words, no labels, no people, no hands.";
  }
  function wirePictureMaker(r) {
    var status = $("picture-status");
    function say(text, bad) { status.textContent = text; status.classList.toggle("bad", !!bad); }
    function start() {
      if (!veniceKey) {
        $("key-box").hidden = false;
        $("make-picture").hidden = true;
        $("venice-key").focus();
        return;
      }
      generate();
    }
    function generate() {
      $("make-picture").hidden = true;
      $("key-box").hidden = true;
      say("Making the picture. This takes about 10 to 30 seconds…");
      fetch(VENICE_URL, {
        method: "POST",
        headers: { "Authorization": "Bearer " + veniceKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VENICE_MODEL, prompt: picturePrompt(r),
          negative_prompt: "text, words, letters, watermark, logo, people, hands, blurry, distorted",
          width: 1280, height: 640, format: "jpeg", safe_mode: true, hide_watermark: true,
        }),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (res.status === 401) { veniceKey = ""; throw new Error("Venice didn't accept that key. Check it and try again."); }
            if (res.status === 402) throw new Error("The Venice account is out of credit.");
            if (!res.ok || !data.images || !data.images.length) throw new Error("Venice couldn't make the picture" + (data.error ? ": " + data.error : ".") );
            return "data:image/jpeg;base64," + data.images[0];
          });
        })
        .then(function (dataUrl) {
          say("Saving the picture…");
          return fetch("api/searchlight-image", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: r.id, imageData: dataUrl }),
          }).then(function (res) {
            return res.json().then(function (data) {
              if (!res.ok) throw new Error(data.error || "Couldn't save the picture.");
              return data.image;
            });
          });
        })
        .then(function (path) {
          r.image = path;
          if (location.hash === "#/r/" + r.id) showRecipe(r);
          search();
        })
        .catch(function (e) {
          say(e.message || "Something went wrong. Try again.", true);
          $("make-picture").hidden = false;
          $("make-picture").textContent = "Try again";
        });
    }
    $("make-picture").addEventListener("click", start);
    $("use-key").addEventListener("click", function () {
      veniceKey = $("venice-key").value.trim();
      if (!veniceKey) { say("Paste your Venice API key first.", true); return; }
      generate();
    });
    $("venice-key").addEventListener("keydown", function (e) { if (e.key === "Enter") $("use-key").click(); });
  }

  /* ---------- Add or change a family recipe ---------- */
  var form = $("add-form");
  var nutritionInputs = $("f-nutrition");
  nutritionInputs.innerHTML = NUTRIENTS.map(function (n) {
    return '<label><span>' + n[1] + (n[2] ? " (" + n[2] + ")" : "") + '</span><input type="number" min="0" step="any" inputmode="decimal" name="n-' + n[0] + '"></label>';
  }).join("");
  var pending = { image: undefined, card: undefined };   // new pictures waiting to be saved
  var mealTouched = false;

  function setMeals(list) {
    form.querySelectorAll('input[name=meal]').forEach(function (b) { b.checked = list.indexOf(b.value) >= 0; });
  }
  form.querySelectorAll("input[name=meal]").forEach(function (b) {
    b.addEventListener("change", function () { mealTouched = true; });
  });
  $("f-type").addEventListener("change", function () {
    if (!mealTouched) setMeals(TYPE_MEALS[this.value] || []);
  });

  function groupsToText(groups) {
    return (groups || []).map(function (g) {
      return (g.heading ? g.heading + ":\n" : "") + g.items.join("\n");
    }).join("\n\n");
  }
  function textToGroups(text) {
    var groups = [{ heading: "", items: [] }];
    text.split(/\n/).map(function (l) { return l.trim(); }).forEach(function (l) {
      if (!l) return;
      if (/:$/.test(l) && l.length < 40) groups.push({ heading: l.slice(0, -1), items: [] });
      else groups[groups.length - 1].items.push(l.replace(/^[-•*·]\s*/, ""));
    });
    return groups.filter(function (g) { return g.items.length; });
  }
  function lines(text) {
    return text.split(/\n/).map(function (l) { return l.trim().replace(/^(\d+[.)]|step \d+:?)\s*/i, ""); }).filter(Boolean);
  }

  function openForm(r) {
    form.reset();
    pending = { image: undefined, card: undefined };
    mealTouched = !!r;
    $("scan-thumbs").innerHTML = "";
    $("scan-status").textContent = "";
    $("save-status").textContent = "";
    $("keep-card-row").hidden = true;
    $("add-offline").hidden = familyOnline;
    $("add-title").textContent = r ? "Change " + r.title : "Add a Family Recipe";
    $("cancel-add").href = r ? "#/r/" + r.id : "#/";
    form.elements.id.value = r ? r.id : "";
    $("f-type").value = r ? r.type : "beef";
    setMeals(r ? r._meals : TYPE_MEALS[$("f-type").value]);
    if (r) {
      ["title", "credit", "serves", "blurb", "tip"].forEach(function (k) { form.elements[k].value = r[k] || ""; });
      form.elements.prep.value = r.times.Prep || "";
      form.elements.cook.value = r.times.Cook || "";
      form.elements.ingredients.value = groupsToText(r.ingredients);
      form.elements.steps.value = r.steps.join("\n");
      form.elements.notes.value = r.notes.join("\n");
      NUTRIENTS.forEach(function (n) {
        form.elements["n-" + n[0]].value = r.nutrition && r.nutrition[n[0]] != null ? r.nutrition[n[0]] : "";
      });
    }
    showPhoto(r && r.image);
  }

  function showPhoto(src) {
    $("dish-preview").innerHTML = src
      ? '<img src="' + esc(src) + '" alt="Dish photo"><button type="button" class="link-button" id="drop-photo">Take the photo off</button>'
      : "";
    if (src) $("drop-photo").addEventListener("click", function () { pending.image = null; showPhoto(null); });
  }

  /* Phone photos are huge: shrink to at most `max` pixels on the long side, as JPEG. */
  function shrink(file, max) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = function () { reject(new Error("That picture couldn't be opened.")); };
      img.src = url;
    });
  }

  $("dish-input").addEventListener("change", function () {
    if (!this.files[0]) return;
    shrink(this.files[0], 1400).then(function (data) { pending.image = data; showPhoto(data); })
      .catch(function (e) { alert(e.message); });
    this.value = "";
  });

  /* Reading the card: Tesseract (free, runs in the browser) is fetched the first time it's needed. */
  var tesseract = null;
  function loadTesseract() {
    if (!tesseract) {
      tesseract = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
        s.onload = function () { resolve(window.Tesseract); };
        s.onerror = function () { tesseract = null; reject(new Error("The card reader couldn't load. Check the internet connection.")); };
        document.head.appendChild(s);
      });
    }
    return tesseract;
  }

  $("scan-input").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files);
    this.value = "";
    if (!files.length) return;
    var status = $("scan-status");
    var pages = [];
    status.textContent = "Getting the card reader ready…";
    Promise.all(files.map(function (f) { return shrink(f, 2000); }))
      .then(function (shots) {
        pages = shots;
        $("scan-thumbs").innerHTML = shots.map(function (s) { return '<img src="' + s + '" alt="Scanned card">'; }).join("");
        return loadTesseract();
      })
      .then(function (T) {
        var text = [];
        return pages.reduce(function (p, shot, i) {
          return p.then(function () {
            return T.recognize(shot, "eng", {
              logger: function (m) {
                if (m.status === "recognizing text") {
                  status.textContent = "Reading card " + (i + 1) + " of " + pages.length + "… " + Math.round(m.progress * 100) + "%";
                }
              },
            }).then(function (res) { text.push(res.data.text); });
          });
        }, Promise.resolve()).then(function () { return text.join("\n"); });
      })
      .then(function (text) {
        fillFromScan(parseCard(text));
        pending.card = pages[0];
        $("keep-card-row").hidden = false;
        status.textContent = "Done! Check every line below — handwriting and faded print can fool the reader.";
      })
      .catch(function (e) { status.textContent = e.message || "Couldn't read that picture."; });
  });

  var UNIT_WORDS = /\b(cups?|c\.|tablespoons?|tbsp?s?\.?|teaspoons?|tsps?\.?|pounds?|lbs?\.?|ounces?|oz\.?|cans?|packages?|pkgs?\.?|sticks?|cloves?|pinch|dash|quarts?|pints?|jars?|boxes|box|envelopes?|slices?|dozen)\b/i;
  function looksLikeIngredient(l) {
    return l.length < 70 && (/^([\d¼½¾⅓⅔⅛]|one |two |three |a |an |pinch|dash)/i.test(l) || UNIT_WORDS.test(l));
  }

  /* Split what the reader saw into name, ingredients and directions. */
  function parseCard(text) {
    var all = text.replace(/\r/g, "").split("\n").map(function (l) { return l.replace(/\s+/g, " ").trim(); })
      .filter(function (l) { return l && /[a-z0-9]/i.test(l); });
    var r = { title: "", serves: "", blurb: [], ingredients: [], steps: [] };
    var section = "top";
    all.forEach(function (l) {
      if (/^ingredients?\b:?/i.test(l)) { section = "ing"; return; }
      if (/^(directions|instructions|method|preparation|steps|to make|how to make|procedure)\b:?/i.test(l)) { section = "dir"; return; }
      if (/^(serves|makes|yield|servings)\b/i.test(l)) { r.serves = l.replace(/^(serves|yield|servings)\s*:?\s*/i, ""); return; }
      if (section === "top") {
        if (!r.title) { r.title = l; return; }
        if (looksLikeIngredient(l)) { section = "ing"; r.ingredients.push(l); return; }
        r.blurb.push(l);
        return;
      }
      if (section === "ing") {
        if (looksLikeIngredient(l) || /:$/.test(l)) r.ingredients.push(l);
        else if (l.length < 30 && r.ingredients.length && !/[.!]$/.test(l)) r.ingredients[r.ingredients.length - 1] += " " + l;
        else { section = "dir"; r.steps.push(l); }
        return;
      }
      r.steps.push(l);
    });
    /* A card's directions wrap across lines: join them back into whole steps. */
    var steps = [];
    r.steps.forEach(function (l) {
      var starts = /^(\d+[.)]|step \d+)/i.test(l) || !steps.length || /[.!]$/.test(steps[steps.length - 1]);
      if (starts) steps.push(l.replace(/^(\d+[.)]|step \d+:?)\s*/i, ""));
      else steps[steps.length - 1] += " " + l;
    });
    r.steps = steps;
    return r;
  }

  function fillFromScan(r) {
    var el = form.elements;
    if (r.title && !el.title.value) el.title.value = r.title.replace(/^recipe\s*(for|:)\s*/i, "");
    if (r.serves && !el.serves.value) el.serves.value = r.serves;
    if (r.blurb.length && !el.blurb.value) el.blurb.value = r.blurb.join(" ");
    if (r.ingredients.length) el.ingredients.value = (el.ingredients.value ? el.ingredients.value + "\n" : "") + r.ingredients.join("\n");
    if (r.steps.length) el.steps.value = (el.steps.value ? el.steps.value + "\n" : "") + r.steps.join("\n");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var el = form.elements;
    var nutrition = {};
    NUTRIENTS.forEach(function (n) { if (el["n-" + n[0]].value !== "") nutrition[n[0]] = +el["n-" + n[0]].value; });
    var times = {};
    if (el.prep.value.trim()) times.Prep = el.prep.value.trim();
    if (el.cook.value.trim()) times.Cook = el.cook.value.trim();
    var body = {
      id: el.id.value || undefined,
      title: el.title.value.trim(),
      type: el.type.value,
      meal: Array.prototype.filter.call(form.querySelectorAll("input[name=meal]"), function (b) { return b.checked; })
        .map(function (b) { return b.value; }),
      credit: el.credit.value.trim(),
      serves: el.serves.value.trim(),
      times: times,
      blurb: el.blurb.value.trim(),
      ingredients: textToGroups(el.ingredients.value),
      steps: lines(el.steps.value),
      tip: el.tip.value.trim(),
      notes: lines(el.notes.value),
      nutrition: Object.keys(nutrition).length ? Object.assign({ basis: "per serving" }, nutrition) : null,
    };
    if (pending.image) body.imageData = pending.image;
    else if (pending.image === null) body.image = null;
    if (pending.card && $("keep-card").checked) body.cardData = pending.card;
    $("save-status").textContent = "Saving…";
    $("save-recipe").disabled = true;
    fetch("api/family", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().then(function (j) { if (!res.ok) throw new Error(j.error || "Couldn't save."); return j; });
      })
      .then(function (saved) {
        return loadFamily().then(function () { search(); location.hash = "#/r/" + saved.id; });
      })
      .catch(function (err) {
        $("save-status").textContent = /fetch|network/i.test(err.message)
          ? "Couldn't reach the website's computer. Is py serve.py running?" : err.message;
      })
      .then(function () { $("save-recipe").disabled = false; });
  });

  /* ---------- Meal planner ---------- */
  var plan = store("plan");
  var planNutrition = nutritionFilter($("p-nutrition"), $("p-custom"), function () {});
  var DAY = 86400000;

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseDay(s) { var p = s.split("-"); return new Date(+p[0], p[1] - 1, +p[2]); }
  function nice(s, long) {
    return parseDay(s).toLocaleDateString(undefined, long
      ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  $("plan-start").value = iso(new Date(Date.now() + DAY));
  $("all-meals").addEventListener("click", function () {
    $("plan-form").querySelectorAll("input[name=meal]").forEach(function (b) { b.checked = true; });
  });

  function planFilter() {
    return {
      ingredient: $("p-ingredient").value,
      type: $("p-type").value,
      library: $("p-library").value,
      tried: $("p-tried").checked,
      nutrition: planNutrition(),
    };
  }
  /* Recipes that suit one kind of meal. Sides and desserts ignore the type and ingredient
     choices (a "Chicken" plan still needs a side), but keep the nutrition and library ones. */
  function pool(meal, f) {
    var g = meal === "side" || meal === "dessert" ? Object.assign({}, f, { type: "", ingredient: "" }) : f;
    return recipes.filter(function (r) { return r._meals.indexOf(meal) >= 0 && matches(r, g); });
  }

  $("make-plan").addEventListener("click", function () {
    var pf = $("plan-form");
    var meals = Array.prototype.filter.call(pf.querySelectorAll("input[name=meal]"), function (b) { return b.checked; })
      .map(function (b) { return b.value; });
    var extras = Array.prototype.filter.call(pf.querySelectorAll("input[name=extra]"), function (b) { return b.checked; })
      .map(function (b) { return b.value; });
    if (!meals.length) { $("plan-warning").textContent = "Pick at least one meal."; return; }
    if (meals.indexOf("dinner") < 0) extras = [];
    var start = $("plan-start").value || iso(new Date());
    var span = pf.querySelector("input[name=span]:checked").value;
    var s = parseDay(start);
    var end = span === "day" ? s : span === "week" ? new Date(s.getTime() + 6 * DAY)
      : new Date(s.getFullYear(), s.getMonth() + 1, s.getDate() - 1);
    var days = [];
    for (var d = new Date(s); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(iso(d));

    var f = planFilter();
    var kinds = meals.concat(extras);
    var decks = {}, pools = {}, short = [];
    kinds.forEach(function (k) {
      pools[k] = pool(k, f).map(function (r) { return r.id; });
      decks[k] = [];
      if (!pools[k].length) short.push(MEAL_NAME[k].toLowerCase());
    });
    /* Deal each meal from its own shuffled deck, so nothing repeats until every choice is used. */
    function draw(k, avoid) {
      if (!pools[k].length) return null;
      if (!decks[k].length) decks[k] = shuffle(pools[k]);
      var i = decks[k].findIndex(function (id) { return avoid.indexOf(id) < 0; });
      return decks[k].splice(i < 0 ? 0 : i, 1)[0];
    }
    var slots = [];
    days.forEach(function (day) {
      var today = [];
      kinds.forEach(function (k) {
        var id = draw(k, today);
        today.push(id);
        slots.push({ date: day, meal: k, id: id });
      });
    });
    plan = { start: start, span: span, days: days, meals: kinds, filter: f, slots: slots, have: {} };
    store("plan", plan);
    $("plan-warning").textContent = short.length
      ? "No " + short.join(" or ") + " recipes match those choices, so those spots are empty. Try fewer choices." : "";
    showPlan();
  });

  function planTitle() {
    var n = plan.days.length;
    return (n === 1 ? "Meals for " + nice(plan.days[0], true)
      : "Meals for " + nice(plan.days[0]) + " – " + nice(plan.days[n - 1]));
  }

  function showPlan() {
    if (!plan) { $("plan-result").hidden = true; return; }
    $("plan-result").hidden = false;
    $("plan-heading").textContent = planTitle();
    var html = '<table><thead><tr><th>Day</th>' +
      plan.meals.map(function (m) { return "<th>" + MEAL_NAME[m] + "</th>"; }).join("") + "</tr></thead><tbody>";
    plan.days.forEach(function (day) {
      html += '<tr><th scope="row">' + esc(nice(day)) + "</th>";
      plan.meals.forEach(function (m) {
        var i = plan.slots.findIndex(function (s) { return s.date === day && s.meal === m; });
        var r = plan.slots[i].id && byId(plan.slots[i].id);
        html += '<td data-label="' + MEAL_NAME[m] + '">' + (r
          ? '<a href="#/r/' + r.id + '">' + esc(r.title) + "</a>"
          : '<span class="muted">&mdash;</span>') +
          '<button type="button" class="swap" data-slot="' + i + '" title="Swap for another recipe" aria-label="Swap">&#8635;</button></td>';
      });
      html += "</tr>";
    });
    $("plan-table").innerHTML = html + "</tbody></table>";
  }

  $("plan-table").addEventListener("click", function (e) {
    var b = e.target.closest(".swap");
    if (!b) return;
    var slot = plan.slots[+b.dataset.slot];
    var sameDay = plan.slots.filter(function (s) { return s.date === slot.date; }).map(function (s) { return s.id; });
    var choices = pool(slot.meal, plan.filter).filter(function (r) { return sameDay.indexOf(r.id) < 0; });
    if (!choices.length) return;
    slot.id = choices[Math.floor(Math.random() * choices.length)].id;
    store("plan", plan);
    showPlan();
  });
  $("new-plan").addEventListener("click", function () {
    plan = null;
    store("plan", null);
    showPlan();
    $("plan-warning").textContent = "";
    window.scrollTo(0, 0);
  });
  $("to-list").addEventListener("click", function () { location.hash = "#/list"; });

  /* ---------- Shopping list ---------- */
  var ALT_GROUP = /^Mom[’']s (version|sauce|taco chili) for/i;
  var PANTRY = /^(salt|pepper|black pepper|salt and pepper|water|ice|ice water|hot water|boiling water|cold water|warm water|nonstick cooking spray|cooking spray)$/;

  /* "2 cans (10¾ ounces each) condensed cream of chicken soup, undiluted" -> "condensed cream of chicken soup" */
  var MEASURE = new RegExp("^(heaping |level |scant )?(cups?|c\\.|tablespoons?|tbsps?\\.?|teaspoons?|tsps?\\.?|pounds?|lbs?\\.?|" +
    "ounces?|oz\\.?|pints?|quarts?|cans?|jars?|packages?|pkgs?\\.?|boxes|box|bags?|envelopes?|tubes?|sticks?|slices?|cloves?|" +
    "bottles?|cartons?|containers?|dozen|pinch|dash|handful|bunch|heads?)\\s+(of\\s+)?", "i");
  var DESCRIBING = new RegExp("\\b(large|medium|small|whole|fresh|freshly|finely|coarsely|thinly|chopped|diced|minced|sliced|" +
    "shredded|grated|softened|melted|divided|beaten|crushed|cubed|cooked|uncooked|frozen|thawed|drained|rinsed|peeled|halved|" +
    "quartered|packed|firmly|lightly|sifted|cut up|optional)\\b", "gi");
  function ingredientName(line) {
    var s = line.replace(/‑/g, "-").replace(/\([^)]*\)/g, " ").split(",")[0].trim();
    for (var i = 0; i < 2; i++) {          // twice, for "1 cup plus 2 tablespoons sugar"
      s = s.replace(/^(about |plus )?[\d\s½⅓⅔¼¾⅛.\-–\/]+(to [\d½⅓⅔¼¾⅛.\/]+\s*)?/i, "");
      s = s.replace(/^-?(pound|ounce|inch)\s+/i, "").replace(MEASURE, "").replace(MEASURE, "");
    }
    s = s.replace(DESCRIBING, " ").replace(/\bfully\b/gi, " ");
    s = s.replace(/\b(for serving|for garnish|to taste|if desired)\b.*$/i, "").replace(/\s+/g, " ").trim();
    s = s || line;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /* "Cheddar cheese" and "cheddar" go on one line. */
  function ingredientKey(name) {
    var words = plain(name).replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean).map(stem);
    if (words.length > 1) words = words.filter(function (w) { return w !== "cheese"; });
    return words.join(" ");
  }

  function shoppingItems() {
    var items = {};
    plan.slots.forEach(function (slot) {
      var r = slot.id && byId(slot.id);
      if (!r) return;
      r.ingredients.forEach(function (g) {
        if (ALT_GROUP.test(g.heading || "")) return;
        g.items.forEach(function (line) {
          var name = ingredientName(line);
          var key = ingredientKey(name);
          if (!items[key]) items[key] = { key: key, name: name, uses: [] };
          items[key].uses.push({ line: line, date: slot.date, meal: slot.meal, title: r.title });
        });
      });
    });
    return Object.keys(items).map(function (k) {
      var it = items[k];
      it.first = it.uses.reduce(function (m, u) { return u.date < m ? u.date : m; }, it.uses[0].date);
      return it;
    }).sort(function (a, b) { return a.first < b.first ? -1 : a.first > b.first ? 1 : a.name < b.name ? -1 : 1; });
  }
  function has(it) {
    return plan.have[it.key] != null ? plan.have[it.key] : PANTRY.test(it.name.toLowerCase());
  }

  function useLine(u) {
    return '<li><span class="use-what">' + esc(u.line) + '</span> <span class="use-when">' + esc(nice(u.date)) +
      " &middot; " + MEAL_NAME[u.meal] + " &middot; " + esc(u.title) + "</span></li>";
  }

  function showList() {
    if (!plan) { location.hash = "#/plan"; return; }
    var items = shoppingItems();
    var html = "", lastDate = "";
    items.forEach(function (it, i) {
      if (it.first !== lastDate) {
        html += '<h3 class="need-by">Needed by ' + esc(nice(it.first, true)) + "</h3>";
        lastDate = it.first;
      }
      var h = has(it);
      html += '<div class="item' + (h ? " have" : "") + '">' +
        '<div class="item-name">' + esc(it.name) + "</div>" +
        '<div class="have-need" role="radiogroup" aria-label="' + esc(it.name) + '">' +
        '<label><input type="radio" name="hn' + i + '" value="have" data-key="' + esc(it.key) + '"' + (h ? " checked" : "") + "> Have it</label>" +
        '<label><input type="radio" name="hn' + i + '" value="need" data-key="' + esc(it.key) + '"' + (h ? "" : " checked") + "> Need it</label>" +
        "</div><ul class=\"uses\">" + it.uses.map(useLine).join("") + "</ul></div>";
    });
    $("shopping").innerHTML = html || '<p class="empty">The planned recipes have no ingredient lists.</p>';
    countList(items);
  }
  function countList(items) {
    var need = items.filter(function (it) { return !has(it); }).length;
    $("list-count").textContent = need + " to buy · " + (items.length - need) + " on hand";
  }
  $("shopping").addEventListener("change", function (e) {
    if (e.target.type !== "radio") return;
    plan.have[e.target.dataset.key] = e.target.value === "have";
    store("plan", plan);
    e.target.closest(".item").classList.toggle("have", e.target.value === "have");
    countList(shoppingItems());
  });
  function markAll(value) {
    shoppingItems().forEach(function (it) { plan.have[it.key] = value; });
    store("plan", plan);
    showList();
  }
  $("all-need").addEventListener("click", function () { markAll(false); });
  $("all-have").addEventListener("click", function () { markAll(true); });

  /* ---------- Printing the plan, the list and the recipe cards ---------- */
  function printOut(html) {
    $("print-area").innerHTML = html;
    document.body.classList.add("printing");
    setTimeout(function () { window.print(); }, 50);
  }
  window.addEventListener("afterprint", function () { document.body.classList.remove("printing"); });

  function printHead(title) {
    return '<div class="p-head"><div class="p-brand">Mom\'s Kitchen</div><h1>' + esc(title) + "</h1></div>";
  }
  function printPlan() {
    var html = printHead(planTitle()) + '<table class="p-plan"><thead><tr><th>Day</th>' +
      plan.meals.map(function (m) { return "<th>" + MEAL_NAME[m] + "</th>"; }).join("") + "</tr></thead><tbody>";
    plan.days.forEach(function (day) {
      html += "<tr><th>" + esc(nice(day)) + "</th>" + plan.meals.map(function (m) {
        var s = plan.slots.find(function (x) { return x.date === day && x.meal === m; });
        var r = s && s.id && byId(s.id);
        return "<td>" + (r ? esc(r.title) : "&mdash;") + "</td>";
      }).join("") + "</tr>";
    });
    printOut(html + "</tbody></table>");
  }
  function printList() {
    var items = shoppingItems().filter(function (it) { return !has(it); });
    var html = printHead("Shopping list · " + planTitle().replace(/^Meals for /, ""));
    if (!items.length) html += "<p>Everything's in the pantry &mdash; nothing to buy!</p>";
    var lastDate = "";
    items.forEach(function (it) {
      if (it.first !== lastDate) {
        html += '<h2 class="p-need-by">Needed by ' + esc(nice(it.first, true)) + "</h2>";
        lastDate = it.first;
      }
      html += '<div class="p-item"><span class="p-box"></span><div><b>' +
        esc(it.name) + "</b><ul>" + it.uses.map(useLine).join("") + "</ul></div></div>";
    });
    printOut(html);
  }
  function printCards() {
    var seen = {}, list = [];
    plan.slots.forEach(function (s) {
      if (s.id && !seen[s.id] && byId(s.id)) { seen[s.id] = true; list.push({ r: byId(s.id), dates: [] }); }
      if (s.id && seen[s.id]) list.find(function (x) { return x.r.id === s.id; }).dates.push(nice(s.date));
    });
    printOut(list.map(function (x) {
      var r = x.r;
      return '<div class="p-card"><div class="p-card-top"><span>From the kitchen of ' +
        esc(kitchenOf(r)) + "</span><span>" + esc(x.dates.join(", ")) + "</span></div>" +
        "<h2>" + (numberOf(r) ? '<span class="p-no">No. ' + numberOf(r) + "</span> " : "") + esc(r.title) + "</h2>" +
        '<p class="p-meta">' + [r.serves && "Makes " + r.serves].concat(Object.keys(r.times).map(function (k) { return k + ": " + r.times[k]; }))
          .filter(Boolean).map(esc).join(" &middot; ") + "</p>" +
        '<div class="p-cols"><div>' + ingredientList(r) + "</div><ol>" +
        r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div>" +
        (r.tip ? '<p class="p-tip"><b>Tip:</b> ' + esc(r.tip) + "</p>" : "") +
        r.notes.map(function (t) { return '<p class="p-tip"><b>' + (r.family || r.searchlight ? "Note" : "Mom's note") + ":</b> " + esc(t) + "</p>"; }).join("") +
        "</div>";
    }).join(""));
  }
  $("print-plan").addEventListener("click", printPlan);
  $("print-plan-2").addEventListener("click", printPlan);
  $("print-list").addEventListener("click", printList);
  $("print-cards").addEventListener("click", printCards);

  /* ---------- Pages: #/ recipe box, #/r/<id> a recipe, #/add, #/edit/<id>, #/plan, #/list ---------- */
  var homeScroll = 0;
  var PAGES = ["home", "recipe", "add", "plan", "list"];
  function show(page, tab) {
    if (!$("home").hidden && page !== "home") homeScroll = window.scrollY;
    PAGES.forEach(function (p) { $(p).hidden = p !== page; });
    document.querySelectorAll(".tabs a").forEach(function (a) { a.classList.toggle("active", a.dataset.tab === tab); });
    document.body.classList.remove("printing");
  }
  function route() {
    var h = location.hash;
    var m = h.match(/^#\/(r|edit)\/(.+)$/);
    var r = m && byId(decodeURIComponent(m[2]));
    if (m && m[1] === "r" && r) {
      show("recipe", "home");
      showRecipe(r);
      window.scrollTo(0, 0);
    } else if ((m && m[1] === "edit" && r && r.family) || h === "#/add") {
      show("add", "add");
      openForm(m ? r : null);
      document.title = "Add a Family Recipe – Mom's Kitchen";
      window.scrollTo(0, 0);
    } else if (h === "#/plan") {
      show("plan", "plan");
      showPlan();
      document.title = "Meal Planner – Mom's Kitchen";
      window.scrollTo(0, 0);
    } else if (h === "#/list") {
      show("list", "plan");
      showList();
      document.title = "Shopping List – Mom's Kitchen";
      window.scrollTo(0, 0);
    } else {
      var wasHome = !$("home").hidden;
      show("home", "home");
      document.title = "Mom's Kitchen";
      if (!wasHome) window.scrollTo(0, homeScroll);
    }
  }
  window.addEventListener("hashchange", route);

  search();
  route();
  Promise.all([loadFamily(), loadPictures()]).then(function () { search(); route(); });
})();
