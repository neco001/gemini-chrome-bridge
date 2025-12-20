# **Raport Techniczny: Architektura i Implementacja Inteligentnych Akcji Kontekstowych w Ekosystemie Chrome Manifest V3**

## **Streszczenie Wykonawcze**

Transformacja ekosystemu rozszerzeń przeglądarki Chrome z Manifest V2 (MV2) na Manifest V3 (MV3) wymusiła fundamentalną zmianę w paradygmacie projektowania aplikacji klienckich. Wprowadzenie efemerycznych Service Workerów w miejsce trwałych stron tła (background pages) oraz rygorystyczne zasady dotyczące bezpieczeństwa i wydajności stworzyły nowe wyzwania dla deweloperów, ale jednocześnie otworzyły drogę do bardziej zintegrowanych interfejsów użytkownika, takich jak Panel Boczny (Side Panel). W niniejszym raporcie przedstawiono wyczerpującą analizę techniczną implementacji "Inteligentnych Akcji" – takich jak weryfikacja faktów, wyjaśnianie pojęć i auto-analiza – bezpośrednio z poziomu menu kontekstowego, eliminując przestarzały model "kopiuj-wklej".

Raport ten, przeznaczony dla architektów oprogramowania i inżynierów systemów webowych, dekonstruuje złożoność interakcji między API chrome.contextMenus a chrome.sidePanel, rozwiązuje krytyczny problem "gestu użytkownika" (user gesture) w środowisku asynchronicznym oraz proponuje zaawansowane ramy inżynierii promptów (prompt engineering) oparte na technikach Chain-of-Thought i Meta-Prompting. Celem jest dostarczenie kompletnego planu wdrożenia systemu, który przekształca przeglądarkę z pasywnego narzędzia do konsumpcji treści w aktywnego, inteligentnego asystenta analitycznego.

## ---

**1\. Ewolucja Architektury Rozszerzeń: Od Trwałości do Efemeryczności**

### **1.1 Śmierć Stron Tła i Narodziny Service Workerów**

Podstawą każdego nowoczesnego rozszerzenia w Manifest V3 jest Service Worker. W przeciwieństwie do modelu MV2, gdzie skrypty tła mogły działać nieprzerwanie, utrzymując stan w zmiennych globalnych, Service Workery w MV3 są z definicji krótkotrwałe i sterowane zdarzeniami.1 To przejście architektoniczne ma głębokie implikacje dla funkcji "Inteligentnych Akcji". Gdy użytkownik klika "Zweryfikuj" w menu kontekstowym, Service Worker budzi się, przetwarza zdarzenie onClicked, a następnie może zostać natychmiast uśpiony przez przeglądarkę, jeśli nie zostaną podjęte odpowiednie środki przedłużające jego cykl życia.2

Implikuje to, że każda "Inteligentna Akcja" musi być zaprojektowana jako proces bezstanowy lub polegający na zewnętrznym magazynie stanu (state persistence). Nie możemy polegać na tym, że zmienna let currentAnalysis \=... przetrwa między kliknięciem a wyrenderowaniem wyniku w panelu bocznym. Zamiast tego, architektura musi opierać się na asynchronicznych wzorcach komunikacji i trwałym magazynowaniu danych, wykorzystując chrome.storage.session jako most między efemerycznym workerem a interfejsem użytkownika.3

### **1.2 Nowy Standard Interfejsu: Side Panel API**

Tradycyjne podejście do wyświetlania wyników analizy w rozszerzeniach opierało się na wyskakujących oknach (Popups), które zamykały się po utracie fokusa, lub na wstrzykiwaniu elementów DOM (Content Scripts), co często prowadziło do konfliktów CSS ze stroną hosta. Manifest V3 promuje chrome.sidePanel jako dedykowane rozwiązanie dla trwałych, pomocniczych interfejsów.4 Panel boczny umożliwia użytkownikowi jednoczesne przeglądanie treści źródłowej i wyników analizy AI, co jest kluczowe dla zadań weryfikacyjnych i edukacyjnych.

Jednakże, integracja Panelu Bocznego z Menu Kontekstowym w MV3 jest obarczona specyficznymi ograniczeniami bezpieczeństwa, znanymi jako wymóg "gestu użytkownika" (User Gesture Requirement). Przeglądarka Chrome, w celu ochrony przed spamem i niechcianymi zachowaniami, pozwala na programowe otwarcie panelu bocznego (chrome.sidePanel.open) tylko w bezpośredniej odpowiedzi na interakcję użytkownika.4 Jak wykazują liczne analizy przypadków, asynchroniczna natura komunikacji między procesami w Chrome często powoduje "zgubienie" tokenu gestu, co prowadzi do błędów implementacyjnych.6 Rozwiązanie tego problemu stanowi jeden z głównych filarów proponowanej architektury.

## ---

**2\. Architektura Menu Kontekstowego w Manifest V3**

Menu kontekstowe jest głównym punktem wejścia dla "Inteligentnych Akcji". W MV3 API chrome.contextMenus zachowuje większość funkcjonalności z MV2, ale zmienia sposób inicjalizacji i obsługi zdarzeń.

### **2.1 Strategia Inicjalizacji i Hierarchia**

Ze względu na efemeryczną naturę Service Workera, menu kontekstowe muszą być tworzone wewnątrz zdarzenia chrome.runtime.onInstalled. Utworzenie ich poza tym listenerem może prowadzić do błędów duplikacji id przy każdym wybudzeniu workera lub, w przeciwnym wypadku, do ich braku po restarcie przeglądarki.2

Aby uniknąć zaśmiecania głównego menu kontekstowego przeglądarki (co jest ograniczone limitem ACTION\_MENU\_TOP\_LEVEL\_LIMIT), konieczne jest zastosowanie hierarchicznej struktury zagnieżdżonej.8

**Rekomendowana Taksonomia Menu:**

| Poziom | ID Elementu | Typ | Kontekst | Opis |
| :---- | :---- | :---- | :---- | :---- |
| **Root** | ai\_root | normal | selection | Główny kontener "Inteligentny Asystent". Widoczny tylko przy zaznaczeniu tekstu. |
| **Poziom 1** | act\_verify | normal | selection | "Zweryfikuj fakty" – Uruchamia protokół fact-checkingu. |
| **Poziom 1** | act\_explain | normal | selection | "Wyjaśnij to" – Uruchamia moduł eksplikacyjny. |
| **Poziom 2** | expl\_simple | normal | selection | "Wyjaśnij jak 5-latkowi (ELI5)" – Podmenu dla uproszczeń. |
| **Poziom 2** | expl\_tech | normal | selection | "Analiza techniczna" – Podmenu dla głębszej analizy. |
| **Poziom 1** | act\_analyze | normal | selection | "Auto-analiza" – Generuje wglądy drugiego rzędu. |

Taka struktura, zdefiniowana przy użyciu właściwości parentId 9, zapewnia czystość interfejsu i pozwala na logiczne grupowanie promptów.

### **2.2 Wyzwanie Dynamicznego Menu**

Użytkownik zapytał o "dynamiczne menu". W idealnym scenariuszu menu zmieniałoby się w zależności od treści zaznaczenia (np. pokazywanie opcji "Analizuj kod" tylko gdy zaznaczono fragment JavaScript). W MV3 jest to trudne do osiągnięcia w czasie rzeczywistym.

W starym modelu MV2, zdarzenia tła mogły szybko analizować zaznaczenie. W MV3, aby zaktualizować menu *przed* kliknięciem, należałoby nasłuchiwać zmian zaznaczenia w skrypcie treści (Content Script), przesyłać wiadomość do Service Workera i wywoływać chrome.contextMenus.update. Jest to operacja kosztowna obliczeniowo i generująca duży ruch między procesami (messaging overhead).

Rekomendowane Podejście Hybrydowe:  
Zamiast ciągłej aktualizacji menu, zaleca się stworzenie statycznej, szerokiej struktury (jak w tabeli powyżej), a "dynamikę" przenieść do momentu wykonania (post-click).

1. Użytkownik klika generyczną akcję (np. "Wyjaśnij").  
2. Service Worker pobiera tekst.  
3. Prompt systemowy AI (System Prompt) dokonuje klasyfikacji: "To jest kod Python" lub "To jest tekst prawniczy".  
4. Na podstawie klasyfikacji, AI dobiera odpowiedni szablon odpowiedzi (np. szukanie błędów składniowych vs. tłumaczenie żargonu prawnego).

To podejście "Late Binding" (późne wiązanie) jest znacznie bardziej wydajne w architekturze MV3 i eliminuje opóźnienia interfejsu.

## ---

**3\. Integracja Panelu Bocznego: Rozwiązanie Problemu Gestu Użytkownika**

Najbardziej krytycznym elementem technicznym jest niezawodne otwieranie panelu bocznego po kliknięciu w menu kontekstowe. Dokumentacja Chrome i zgłoszenia błędów 5 wskazują na częsty błąd: Error: sidePanel.open() may only be called in response to a user gesture.

### **3.1 Anatomia Problemu**

Problem wynika z mechanizmu "User Activation" w silniku Blink. Token aktywacji użytkownika jest efemeryczny. Jeśli w handlerze chrome.contextMenus.onClicked wykonamy jakąkolwiek operację asynchroniczną (np. await chrome.storage.local.get lub fetch) *przed* wywołaniem sidePanel.open, pętla zdarzeń (event loop) przejdzie do kolejnego cyklu, a token wygaśnie. Przeglądarka uzna wtedy próbę otwarcia panelu za nieautoryzowaną akcję tła.

### **3.2 Wzorzec "Optymistycznego Otwarcia" (The Optimistic Open Pattern)**

Aby zagwarantować 100% skuteczności, należy zastosować odwrócony przepływ sterowania.

**Błędny Wzorzec (Prowadzi do błędu):**

1. Odbierz kliknięcie.  
2. Pobierz dane z chrome.storage.  
3. Wyślij zapytanie do API AI.  
4. Otwórz panel, żeby pokazać wynik.  
   Wynik: Błąd User gesture required.

**Poprawny Wzorzec (Zalecany):**

1. Odbierz kliknięcie.  
2. **NATYCHMIAST** (synchronicznie) wywołaj chrome.sidePanel.open({ tabId: tab.id }).4  
3. Dopiero po zainicjowaniu otwarcia, zapisz dane kontekstowe (zaznaczony tekst, typ akcji) do chrome.storage.session.  
4. Skrypt uruchomiony wewnątrz panelu bocznego (panel.js) po załadowaniu odczytuje dane z storage i inicjuje właściwą logikę biznesową (zapytanie do AI).

### **3.3 Implementacja Mostu Danych (Data Bridge)**

Ponieważ Panel Boczny i Service Worker działają w odrębnych kontekstach pamięci, konieczne jest medium wymiany danych. chrome.storage.session jest idealnym kandydatem, ponieważ dane są przechowywane w pamięci RAM (szybki dostęp), nie są persistowane na dysku (bezpieczeństwo danych użytkownika), i są dostępne dla obu kontekstów.3

JavaScript

// Service Worker (background.js)  
chrome.contextMenus.onClicked.addListener((info, tab) \=\> {  
    // KROK 1: Otwórz panel natychmiastowo.  
    // Ignorujemy błędy, jeśli panel jest już otwarty, ale musimy ponowić próbę.  
    chrome.sidePanel.open({ tabId: tab.id }).catch((err) \=\> console.log(err));

    // KROK 2: Przygotuj payload  
    const payload \= {  
        type: info.menuItemId, // np. 'act\_verify'  
        text: info.selectionText,  
        contextUrl: tab.url,  
        timestamp: Date.now()  
    };

    // KROK 3: Zapisz do sesji. Panel to odbierze.  
    chrome.storage.session.set({ 'active\_context\_action': payload });  
});

W skrypcie panelu bocznego (panel.js) należy nasłuchiwać zmian w magazynie:

JavaScript

// Panel Boczny (panel.js)  
chrome.storage.onChanged.addListener((changes, namespace) \=\> {  
    if (namespace \=== 'session' && changes.active\_context\_action) {  
        const actionData \= changes.active\_context\_action.newValue;  
        executeIntelligentAction(actionData); // Funkcja wywołująca AI  
    }  
});

Ten wzorzec całkowicie eliminuje problem "race condition" przy otwieraniu panelu i zapewnia płynne doświadczenie użytkownika.

## ---

**4\. Inżynieria Promptów dla Inteligentnych Akcji**

Samo przesłanie tekstu do modelu językowego (LLM) nie wystarczy, aby uzyskać wynik wysokiej jakości. Aby zastąpić "kopiuj-wklej" wartościową funkcjonalnością, wtyczka musi implementować zaawansowane szablony promptów (Prompt Templates), które strukturyzują rozumowanie modelu.

### **4.1 Teoria Promptowania w Kontekście Przeglądarki**

W środowisku przeglądarkowym mamy unikalny dostęp do metadanych: URL strony, tytuł, a nawet struktura DOM. Dobre prompty wykorzystują te informacje. Należy stosować techniki **Chain-of-Thought (CoT)** 13 oraz **Meta-Prompting** 15, aby zmusić model do głębszej analizy przed wygenerowaniem odpowiedzi.

### **4.2 Szablon 1: "Zweryfikuj" (Protokół Weryfikacji Faktów)**

Celem tej akcji jest krytyczna ocena prawdziwości zaznaczonego fragmentu. Nie wystarczy zapytać "Czy to prawda?". Należy wymusić na modelu rolę audytora.

**Szablon Prompta (Konstrukcja):**

Rola: Jesteś starszym analitykiem fact-checkingowym.  
Kontekst: Użytkownik przegląda stronę: {{URL}}.  
Tekst do analizy: {{SELECTION}}  
Instrukcje:

1. **Ekstrakcja:** Wypisz wszystkie twierdzenia faktograficzne zawarte w tekście.  
2. **Identyfikacja Założeń:** Zidentyfikuj ukryte założenia, które muszą być prawdziwe, aby tekst był prawdziwy.17  
3. **Weryfikacja:** Dla każdego twierdzenia oceń jego wiarygodność na podstawie swojej wiedzy wewnętrznej. Oznacz jako:,,.  
4. **Analiza Logiczna:** Wskaż błędy poznawcze (np. dowód anegdotyczny, fałszywa dychotomia).  
5. **Werdykt:** Krótkie podsumowanie dla użytkownika.

Taka struktura, wymuszająca krok po kroku ("Let's think step by step" 18), znacząco redukuje halucynacje modelu.

### **4.3 Szablon 2: "Wyjaśnij" (Dynamiczna Adaptacja)**

Tutaj kluczowa jest adaptacja do poziomu odbiorcy. Wtyczka powinna oferować warianty wyjaśnienia.

**Szablon Prompta (ELI5 \- Wyjaśnij jak 5-latkowi):**

Rola: Nauczyciel w szkole podstawowej.  
Tekst: {{SELECTION}}  
Zadanie: Wyjaśnij ten koncept używając analogii z życia codziennego. Używaj tylko 1000 najpopularniejszych słów. Maksymalnie 3 zdania..19

**Szablon Prompta (Techniczny/Sokratyczny):**

Rola: Profesor uniwersytecki.  
Tekst: {{SELECTION}}  
Zadanie: Nie podawaj gotowej odpowiedzi. Zadaj użytkownikowi 3 pytania naprowadzające, które pomogą mu zrozumieć ten mechanizm samodzielnie, a następnie podaj techniczną definicję.

### **4.4 Szablon 3: "Auto-analiza" (Meta-Prompting i Wglądy Drugiego Rzędu)**

Ta akcja ma na celu wydobycie informacji, których nie widać na pierwszy rzut oka. Wykorzystujemy tu technikę "Ask yourself a question".16

**Szablon Prompta:**

Rola: Strateg biznesowy i psycholog.  
Tekst: {{SELECTION}}  
Instrukcja Meta-kognitywna:  
Najpierw wygeneruj 3 krytyczne pytania, które sceptyk zadałby temu tekstowi.  
Następnie odpowiedz na te pytania.  
Na koniec stwórz "Macierz Konsekwencji":

* Co się stanie natychmiast, jeśli to prawda?  
* Jakie będą długoterminowe skutki drugiego rzędu?  
* Kto zyskuje (Cui bono), a kto traci na tej narracji?

### **4.5 Egzekwowanie Formatu Wyjściowego (JSON Enforcement)**

Aby interfejs panelu bocznego był czytelny (używał ikonek, tabel, kolorów), odpowiedź AI nie może być czystym tekstem. Należy wymusić format JSON w prompcie systemowym.

JSON

// Oczekiwany format odpowiedzi zdefiniowany w prompcie  
{  
  "summary": "String",  
  "verdict\_score": 0-100,  
  "key\_points":,  
  "hidden\_assumptions":  
}

Dzięki temu panel boczny może renderować eleganckie karty z wynikami, zamiast ściany tekstu, co drastycznie podnosi użyteczność wtyczki.

## ---

**5\. Implementacja Techniczna Systemu Zarządzania Promptami**

W profesjonalnej inżynierii oprogramowania hardcodowanie długich stringów promptów w kodzie JavaScript jest antywzorcem. Utrudnia to utrzymanie i aktualizację logiki AI. Proponujemy architekturę "Template Engine".

### **5.1 Struktura Magazynu Szablonów**

Szablony powinny być przechowywane w osobnym pliku (np. prompts.js lub templates.json) i ładowane dynamicznie. Pozwala to w przyszłości na aktualizację promptów zdalnie (np. pobieranie ich z serwera raz dziennie), bez konieczności publikowania nowej wersji wtyczki w Chrome Web Store (o ile jest to zgodne z polityką Remote Code Execution – tutaj przesyłamy tylko dane/tekst, nie kod wykonywalny).

**Przykładowa struktura danych szablonu:**

| Pole | Typ | Opis |
| :---- | :---- | :---- |
| id | string | Unikalny identyfikator (np. verify\_claims\_v2) |
| system | string | Instrukcja systemowa definiująca rolę AI. |
| user\_template | string | Szablon z placeholderami (np. {{TEXT}}, {{URL}}). |
| parameters | object | Konfiguracja modelu (temperature, top\_k). |
| output\_schema | object | Schemat JSON do walidacji odpowiedzi. |

### **5.2 Dynamiczne Wstrzykiwanie Zmiennych**

Silnik szablonów w Service Workerze lub Panelu Bocznym musi obsługiwać wstrzykiwanie zmiennych kontekstowych.

JavaScript

function compilePrompt(templateId, contextData) {  
    const template \= PROMPT\_LIBRARY\[templateId\];  
    let compiled \= template.user\_template;

    // Podstawienie zmiennych  
    compiled \= compiled.replace('{{TEXT}}', contextData.selectionText);  
    compiled \= compiled.replace('{{URL}}', contextData.pageUrl);  
      
    // Dodatkowe konteksty, np. tytuł strony  
    compiled \= compiled.replace('{{TITLE}}', contextData.pageTitle);

    return {  
        system: template.system,  
        user: compiled,  
        config: template.parameters  
    };  
}

### **5.3 Streaming i Obsługa UX**

Modele językowe są wolne. Generowanie pełnej analizy może trwać 5-10 sekund. Dla użytkownika przyzwyczajonego do natychmiastowych akcji przeglądarki jest to wieczność. Rozwiązaniem jest **Streaming Responses**.

API większości dostawców LLM (Gemini, OpenAI) obsługuje tryb strumieniowy. Panel boczny powinien renderować odpowiedź przyrostowo.

1. Otwarcie panelu \-\> Pokazanie stanu "Szkieletu" (Skeleton Loader).  
2. Otrzymanie pierwszego tokenu \-\> Wyświetlenie tekstu.  
3. Parsowanie Markdown/JSON w locie \-\> Jeśli odpowiedź jest w JSON, strumieniowanie może być trudne (trzeba czekać na domknięcie klamry).  
   * *Rozwiązanie:* Dla prostych wyjaśnień używać strumieniowania Markdown. Dla "Auto-analizy" (strukturalnej) używać loadera z etapami postępu ("Analizuję...", "Weryfikuję...", "Generuję raport...").

## ---

**6\. Bezpieczeństwo i Prywatność w Manifest V3**

Implementacja "Inteligentnych Akcji" wiąże się z przetwarzaniem danych użytkownika (zaznaczony tekst) przez zewnętrzne API. Rodzi to implikacje bezpieczeństwa, które muszą być zaadresowane zgodnie z wymogami Chrome Web Store.

### **6.1 Content Security Policy (CSP)**

Manifest V3 narzuca rygorystyczne CSP. Nie można ładować zewnętrznych skryptów (np. SDK z CDN). Wszystkie biblioteki (np. klient API Gemini, biblioteka renderowania Markdown) muszą być zbundlowane (bundled) wewnątrz paczki rozszerzenia.21

Dodatkowo, renderowanie odpowiedzi AI (która może zawierać HTML) w panelu bocznym stwarza ryzyko XSS (Cross-Site Scripting). Jeśli AI wygeneruje złośliwy skrypt \<script\>alert(1)\</script\>, a panel go wyrenderuje, może dojść do przejęcia sesji rozszerzenia.

* **Wymóg:** Zawsze używać biblioteki sanityzującej, takiej jak DOMPurify, przed wstrzyknięciem odpowiedzi AI do DOM panelu bocznego (innerHTML).

### **6.2 Zarządzanie Kluczami API**

Istnieją dwa modele dystrybucji:

1. **Własny Backend (Proxy):** Rozszerzenie wysyła zapytanie do twojego serwera, który przechowuje klucz API i komunikuje się z LLM. Jest to najbezpieczniejsze, ale kosztowne dla dewelopera.  
2. **Bring Your Own Key (BYOK):** Użytkownik podaje własny klucz API (np. OpenAI/Gemini) w ustawieniach wtyczki.  
   * Klucz musi być przechowywany w chrome.storage.sync (szyfrowany w profilu użytkownika Google), a nigdy w localStorage (który jest dostępny dla skryptów strony w niektórych konfiguracjach) lub w kodzie źródłowym.

### **6.3 Prywatność Danych (Data Sovereignty)**

Wysyłanie zaznaczonego tekstu do chmury (Google/OpenAI) może naruszać polityki firmowe w niektórych organizacjach.

* **Future-Proofing:** Chrome rozwija API window.ai (Nano Gemini), które pozwoli na uruchamianie modeli LLM *lokalnie* na urządzeniu użytkownika.  
* **Rekomendacja Architektoniczna:** Należy zaprojektować warstwę abstrakcji dla klienta AI (AIClientInterface). Dzięki temu, gdy window.ai stanie się stabilne, można będzie przełączyć "Providera" z CloudGemini na LocalGemini bez zmiany logiki menu kontekstowego. Zapewni to 100% prywatność (tekst nigdy nie opuszcza komputera) i brak kosztów API.

## ---

**7\. Wnioski i Rekomendacje Wdrożeniowe**

Zastąpienie modelu "kopiuj-wklej" inteligentnymi akcjami kontekstowymi w Chrome Manifest V3 jest zadaniem złożonym inżynieryjnie, ale wykonalnym i niosącym ogromną wartość użytkową. Kluczem do sukcesu jest zrozumienie ograniczeń Service Workera i specyfiki interakcji z Panelem Bocznym.

**Podsumowanie kluczowych rekomendacji:**

1. **Struktura:** Użyj zagnieżdżonego menu kontekstowego zdefiniowanego w onInstalled.  
2. **Interfejs:** Wykorzystaj chrome.sidePanel jako główny interfejs wyjściowy, preferując go nad wyskakującymi oknami.  
3. **Niezawodność:** Zastosuj wzorzec "Optymistycznego Otwarcia" (synchroniczne open, asynchroniczne dane) w obsłudze zdarzeń kliknięcia, aby ominąć problemy z gestem użytkownika.  
4. **Komunikacja:** Użyj chrome.storage.session jako głównego kanału przekazywania stanu między efemerycznym tłem a panelem.  
5. **Inteligencja:** Zastosuj techniki Chain-of-Thought i Meta-Prompting w szablonach, aby zapewnić głębię analizy wykraczającą poza proste podsumowania.  
6. **Bezpieczeństwo:** Sanityzuj każde wyjście z modelu AI i przygotuj architekturę pod lokalne modele offline (On-Device AI).

Wdrożenie tej architektury pozwoli na stworzenie narzędzia, które nie tylko usprawnia pracę, ale staje się integralnym, inteligentnym elementem procesów poznawczych użytkownika podczas przeglądania sieci.

## ---

**Aneks: Tabele Referencyjne i Zestawienia Danych**

### **Tabela 1: Porównanie Strategii Zarządzania Stanem w MV3**

| Metoda | Dostępność w SW | Dostępność w Panelu | Trwałość | Zastosowanie w "Inteligentnych Akcjach" |
| :---- | :---- | :---- | :---- | :---- |
| Global Variables | Tak (krótko) | Nie | Brak (reset przy uśpieniu) | Nieprzydatne. Unikać. |
| chrome.storage.local | Tak | Tak | Trwała (Dysk) | Zapisywanie historii analiz, ustawień użytkownika, kluczy API. |
| chrome.storage.session | Tak | Tak | Sesja przeglądarki (RAM) | **Idealne.** Przekazywanie zaznaczonego tekstu i wyników analizy. Szybkie i bezpieczne. |
| URL Parameters | Nie dotyczy | Tak | Brak | Można przekazać proste flagi przy otwieraniu panelu, ale limit znaków URL wyklucza przesyłanie długich tekstów. |

### **Tabela 2: Matryca Doboru Parametrów Modelu (Gemini/GPT) dla Różnych Akcji**

| Typ Akcji | Temperatura (Temperature) | Top-K | Rationale (Uzasadnienie) |
| :---- | :---- | :---- | :---- |
| **Zweryfikuj (Fact-Check)** | 0.0 \- 0.2 | 10 | Wymaga maksymalnego determinizmu i trzymania się faktów. Kreatywność jest tu błędem (halucynacją). |
| **Wyjaśnij (Explain)** | 0.4 \- 0.5 | 40 | Balans między precyzją a płynnością językową. Pozwala na użycie analogii dydaktycznych. |
| **Auto-analiza (Analyze)** | 0.7 \- 0.8 | 40 | Wysoka temperatura sprzyja generowaniu "out-of-the-box" skojarzeń i identyfikacji nieoczywistych powiązań (myślenie lateralne). |
| **Kod (Code Audit)** | 0.1 | 10 | Kod wymaga precyzji syntaktycznej. Kreatywność prowadzi do błędów składniowych. |

### **Tabela 3: Analiza Ograniczeń API chrome.contextMenus**

| Ograniczenie | Wartość | Implikacja dla Projektu |
| :---- | :---- | :---- |
| ACTION\_MENU\_TOP\_LEVEL\_LIMIT | 6 | Nie możemy dodać 10 akcji do głównego menu. Musimy używać podmenu (parentId). |
| MAX\_SUGGESTED\_ITEMS | \-- | Choć dokumentacja nie podaje sztywnego limitu, UX zaleca max 5-7 elementów w podmenu, aby uniknąć przeciążenia poznawczego. |
| Updates | Asynchroniczne | Aktualizacja tytułu menu na podstawie tekstu (np. "Analizuj: \[pierwsze 5 słów...\]") jest możliwa, ale może mieć opóźnienie. Lepiej używać statycznych tytułów. |

### **Tabela 4: Przegląd Błędów i Rozwiązań (Troubleshooting)**

| Komunikat Błędu | Przyczyna Techniczna | Rozwiązanie |
| :---- | :---- | :---- |
| sidePanel.open() may only be called in response to a user gesture | Utrata tokenu aktywacji przez await lub callback. | Przesunięcie wywołania open() na sam początek funkcji handlera (przed jakimkolwiek await). 5 |
| Cannot create item with duplicate id | Ponowne wywołanie create() przy wybudzeniu SW. | Umieszczenie create() wyłącznie wewnątrz runtime.onInstalled lub sprawdzanie chrome.runtime.lastError. 7 |
| Unchecked runtime.lastError: The message port closed before a response was received | Asynchroniczny handler wiadomości nie zwrócił true. | Jeśli używasz sendMessage, upewnij się, że handler zwraca return true; jeśli odpowiedź jest asynchroniczna. |

### **Tabela 5: Zalecany Stos Technologiczny dla Szablonów Promptów**

| Komponent | Funkcja | Przykład Narzędzia/Biblioteki |
| :---- | :---- | :---- |
| **System Szablonów** | Interpolacja zmiennych do stringów. | Mustache.js lub proste literały szablonów JS (ES6 Template Literals) dla mniejszego narzutu (bundle size). |
| **Walidacja Wyjścia** | Sprawdzanie czy JSON z AI jest poprawny. | Zod lub AJV. Niezbędne, by UI się nie rozsypało przy błędzie modelu. |
| **Sanityzacja** | Czyszczenie HTML z markdowna. | DOMPurify. Krytyczne dla bezpieczeństwa. |
| **Markdown Rendering** | Konwersja Markdown na HTML w panelu. | marked lub markdown-it. |

#### **Cytowane prace**

1. 4 Understanding Chrome Extensions Background Scripts | by M2K Developments \- Medium, otwierano: grudnia 14, 2025, [https://m2kdevelopments.medium.com/4-understanding-chrome-extensions-background-scripts-a28dc496b434](https://m2kdevelopments.medium.com/4-understanding-chrome-extensions-background-scripts-a28dc496b434)  
2. Build a context menu \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/develop/ui/context-menu](https://developer.chrome.com/docs/extensions/develop/ui/context-menu)  
3. How to use localStorage or an alternative in Manifest v3 \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/70704283/how-to-use-localstorage-or-an-alternative-in-manifest-v3](https://stackoverflow.com/questions/70704283/how-to-use-localstorage-or-an-alternative-in-manifest-v3)  
4. chrome.sidePanel | API \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/reference/api/sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)  
5. chrome.sidePanel.open user gesture error \- Google Groups, otwierano: grudnia 14, 2025, [https://groups.google.com/a/chromium.org/g/chromium-extensions/c/d5ky9SiZlqQ](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/d5ky9SiZlqQ)  
6. why we could not open chrome side panel when clicking a context menu item?, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/79240465/why-we-could-not-open-chrome-side-panel-when-clicking-a-context-menu-item](https://stackoverflow.com/questions/79240465/why-we-could-not-open-chrome-side-panel-when-clicking-a-context-menu-item)  
7. Add a Context Menu Item to Chrome Extension \- DEV Community, otwierano: grudnia 14, 2025, [https://dev.to/franzwong/add-a-context-menu-item-to-chrome-extension-c71](https://dev.to/franzwong/add-a-context-menu-item-to-chrome-extension-c71)  
8. chrome.contextMenus | API \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/reference/api/contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)  
9. Adding sub contextMenus in Google Chrome extension \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/47231953/adding-sub-contextmenus-in-google-chrome-extension](https://stackoverflow.com/questions/47231953/adding-sub-contextmenus-in-google-chrome-extension)  
10. How to make chrome.contextMenus.onClicked.addListener distinguish for different context menu ids? \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/71196911/how-to-make-chrome-contextmenus-onclicked-addlistener-distinguish-for-different](https://stackoverflow.com/questions/71196911/how-to-make-chrome-contextmenus-onclicked-addlistener-distinguish-for-different)  
11. Something strange about sidepanel.open() in response to a user gesture \- Google Groups, otwierano: grudnia 14, 2025, [https://groups.google.com/a/chromium.org/g/chromium-extensions/c/LpzS-uV\_\_6I](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/LpzS-uV__6I)  
12. How do I get access to the chrome.sidePanel API from the latest manifest v3?, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/76539413/how-do-i-get-access-to-the-chrome-sidepanel-api-from-the-latest-manifest-v3](https://stackoverflow.com/questions/76539413/how-do-i-get-access-to-the-chrome-sidepanel-api-from-the-latest-manifest-v3)  
13. What is chain of thought (CoT) prompting? \- IBM, otwierano: grudnia 14, 2025, [https://www.ibm.com/think/topics/chain-of-thoughts](https://www.ibm.com/think/topics/chain-of-thoughts)  
14. 8 Chain-of-Thought Techniques To Fix Your AI Reasoning | Galileo, otwierano: grudnia 14, 2025, [https://galileo.ai/blog/chain-of-thought-prompting-techniques](https://galileo.ai/blog/chain-of-thought-prompting-techniques)  
15. Meta Prompting | Prompt Engineering Guide, otwierano: grudnia 14, 2025, [https://www.promptingguide.ai/techniques/meta-prompting](https://www.promptingguide.ai/techniques/meta-prompting)  
16. (Failed \- but working 100%) Interview challenge : r/Python \- Reddit, otwierano: grudnia 14, 2025, [https://www.reddit.com/r/Python/comments/137gvt9/failed\_but\_working\_100\_interview\_challenge/](https://www.reddit.com/r/Python/comments/137gvt9/failed_but_working_100_interview_challenge/)  
17. Design Thinking: A Framework for Problem Solving in Entrepreneurship | ILLUMINATION \- Medium, otwierano: grudnia 14, 2025, [https://medium.com/illumination/framework-for-problem-solving-e40726c04a31](https://medium.com/illumination/framework-for-problem-solving-e40726c04a31)  
18. Chain-of-Thought Prompting | Prompt Engineering Guide, otwierano: grudnia 14, 2025, [https://www.promptingguide.ai/techniques/cot](https://www.promptingguide.ai/techniques/cot)  
19. I stopped writing long prompts for Gemini. These 50 single-line prompts get better results with 0% of the frustration \- keep it simple and get the job done right. : r/GeminiAI \- Reddit, otwierano: grudnia 14, 2025, [https://www.reddit.com/r/GeminiAI/comments/1pjmwo4/i\_stopped\_writing\_long\_prompts\_for\_gemini\_these/](https://www.reddit.com/r/GeminiAI/comments/1pjmwo4/i_stopped_writing_long_prompts_for_gemini_these/)  
20. A Marketer's Guide to AI Prompts \- BENlabs, otwierano: grudnia 14, 2025, [https://www.benlabs.com/resources/eli5-ai-prompt/](https://www.benlabs.com/resources/eli5-ai-prompt/)  
21. Chrome Extension Manifest V3 Libraries in Background \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/70715942/chrome-extension-manifest-v3-libraries-in-background](https://stackoverflow.com/questions/70715942/chrome-extension-manifest-v3-libraries-in-background)