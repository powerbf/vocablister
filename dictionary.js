'use strict';

module.exports = class Dictionary {

    constructor(sourceLang, targetLang) {
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
        this.entries = {};
    }

    addEntry(source, target) {
        // source is the full source language entry, but key is stripped down
        var key = source.replace(/\s*\[[^\]]*\]\s*/g, "");
        key = key.replace(/\s*\([^\)]*\)\s*/g, "");
        key = key.replace(/\s*\{[^\}]*\}\s*/g, "");

        var entry = {};
        entry["key"] = key;
        entry["source"] = source;
        entry["target"] = target;

        if (!(key in this.entries))
            this.entries[key] = [];

        return this.entries[key].push(entry);
    }

    lookup(term) {
        var meanings = this.entries[term];
        if (typeof meanings === 'undefined')
            return [];
        else {
            // consolidate
            let consolidated = {}; 
            for (let i = 0; i < meanings.length; i++) {
                let source = meanings[i].source;
                let target = meanings[i].target;
                if (!(source in consolidated))
                    consolidated[source] = "";
                if (consolidated[source] != "")
                    consolidated[source] += ", ";
                consolidated[source] += target;
            }
            let results = [];
            for (const [key, value] of Object.entries(consolidated)) {
                results.push({key: term, source: key, target: value});
            }
            return results;
        }
    }
}