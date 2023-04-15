const translationEndpoint =
    "https://translation.googleapis.com/language/translate/v2";

const apiKey = "AIzaSyCgOHbHPxFH2j6CwiYgYoyiNp2j_GqbVuI";
const maxNumOfTranslation = 128;
const query = `query getMetaObject($id: ID!) { # A metaobject can be retrieved by handle or id
	metaobject(id: $id) {
		id
		type
		updatedAt
		handle

		fields {
			key
			value
			type
		}

		fields {
			key
			value
			type
		}
	}
}`

const variables = {
	"id": "gid://shopify/Metaobject/5000626522"
}

const body = JSON.stringify({query, variables})
const metaobjectsEndpoint = "https://boas-marketplace.myshopify.com/admin/api/2023-01/graphql.json"

const request = fetch(metaobjectsEndpoint,{
    method: "POST",
    headers:{
        "Content-type":"application/json",
        "X-Shopify-Access-Token":"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"
    },
    body: body,

})

request.then(res => res.json()).then(({data}) => console.log(data))

const translationsCache = {};
const translationDE = {};

console.log(apiKey)

const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 =
        Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
        Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
        Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
        Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};


/**
 * This function is responsible for setting a new entry in a translations cache. The cacheKey and translation parameters are required and must be provided in order to execute the function.

In addition to storing the entry in local storage, the function also stores the entry in an object called translationsCache, which is presumably used for quicker access to recently used translations.
 * @param {*} cacheKey 
 * @param {*} translation 
 * 
 */
const setCacheEntry = (cacheKey, translation) => {
    const cacheEntry = {
        translation,
        timestamp: new Date().getTime(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    translationsCache[cacheKey] = cacheEntry;
};



/**
 * Retrieves the cached translation result for the given cache key, if it exists and is not expired.
 * If the cache entry is expired or doesn't exist, removes it from the cache and local storage and returns null.
 *
 * @param {string} cacheKey - The cache key to retrieve the entry for.
 * @returns {string|null} - The cached translation result string, or null if the entry is expired or doesn't exist.
 */
const getCacheEntry = (cacheKey) => {
    const cacheEntryJSON = localStorage.getItem(cacheKey);
    if (cacheEntryJSON) {
        const cacheEntry = JSON.parse(cacheEntryJSON);
        const ageInMs = new Date().getTime() - cacheEntry.timestamp;
        if (ageInMs < 5 * 60 * 60 * 1000) {
            // Entry is not expired, use cache
            translationsCache[cacheKey] = cacheEntry;
            return cacheEntry.translation;
        } else {
            // Entry is expired, remove from cache and local storage
            delete translationsCache[cacheKey];
            localStorage.removeItem(cacheKey);
        }
    }
    return null;
};

const fetchInstance = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Network error: ${response.status}`);
    }
    return response;
};


/**
 * Translates the given string to the specified language using a translation API.
 * If the translation result is cached, returns the cached result instead of making a new request.
 *
 * @param {string} stringToTranslate - The string to translate.
 * @param {string} language - The language code to translate to (e.g. 'en', 'fr', 'es', etc.).
 * @returns {Promise<object>} - A Promise that resolves to the translation result object.
 */
async function getTranslationFromAPI(stringToTranslate, language) {
    const options = {
        method: "POST",
        body: JSON.stringify({
            q: stringToTranslate,
            target: language,
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8",
        },
    };
    const cacheStringHashed = cyrb53(`${stringToTranslate}`);
    const cacheKey = `${cacheStringHashed}_${language}`;
    const cacheEntry = getCacheEntry(cacheKey);

    if (cacheEntry) {
        return cacheEntry;
    }

    const response = await fetchInstance(
        `${translationEndpoint}?key=${apiKey}`,
        options
    );
    const translation = await response.json();

    setCacheEntry(cacheKey, translation);
    return translation;
}


/**
 * Translate text in elements matching the given selector to the specified language.
 * If there are more than 128 elements, the text is translated in chunks of 64 elements each.
 *
 * @param {string} elementName - The CSS selector for the elements to translate.
 * @param {string} language - The language code to translate to (e.g. 'en', 'fr', 'es', etc.).
 */
async function translateElement(elementName, language) {
    const allElements = document.querySelectorAll(elementName);
    const chunkSize = 64;


    const textsToTranslate = Array.from(
        allElements,
        (element) => element.innerHTML
    ).filter((text) => !translationDE.hasOwnProperty(text));
    
    // If there are more than 128 elements, translate them in chunks.
    if (textsToTranslate.length >= maxNumOfTranslation) {
        for (let j = 0; j < allElements.length; j += chunkSize) {
            // Get the next chunk of elements to translate.
            const chunkElements = textsToTranslate.slice(j, j + chunkSize);
            const {
                data: { translations: result },
            } = await getTranslationFromAPI(chunkElements, language);

            for (var i = 0; i < chunkElements.length; i++) {
                let textElement = allElements[i + j].innerHTML;
                translationDE[textElement] = result[i].translatedText;
            }
        }
    } else {
        const {
            data: { translations: result },
        } = await getTranslationFromAPI(textsToTranslate, language);

        textsToTranslate.forEach((element, index) => {
            translationDE[element] = result[index].translatedText;
        });
    }
    

    allElements.forEach((element, index) => {
        element.innerHTML = translationDE[element.innerHTML];  
    });

}

async function modifyPageLanguage(language) {
    if (language === "en") {
        return;
    }
    const elementsToTranslate = "a:not(.exclude-translation),p:not(.exclude-translation),button:not(.exclude-translation),input:not(.exclude-translation),label,h3,h1:not(.exclude-translation),h2,h4,h5";

    translateElement(elementsToTranslate, language);
}

function languageChanged({ key, oldValue, newValue }) {
    if (key === "language") {
        const isNew = oldValue === null && newValue !== null;
        if (isNew) {
            const newLanguage = localStorage.getItem("language");
            modifyPageLanguage(newLanguage);
        }
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        var currentLanguage = localStorage.getItem("language");

        if (currentLanguage === null || currentLanguage === "en") {
            localStorage.setItem("language", "en");
            currentLanguage = "en";
        } else {
            modifyPageLanguage(currentLanguage);
        }
        window.addEventListener("storage", languageChanged);
    },
    false
);

console.log("Application connected 0.8.0.48")