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
                if (!(source in consolidated))
                    consolidated[source] = [];
                consolidated[source].push(meanings[i].target);
            }
            let results = [];
            for (var [source, targets] of Object.entries(consolidated)) {
                targets = targets.sort((a, b) => {
                    // put meaning without annotations first - they are likely to be more common
                    if (!a.includes("[") && b.includes("["))
                        return -1;
                    else if (a.includes("[") && !b.includes("["))
                        return 1;
                    else
                        return 0;
                });
                let target = targets.join(", ");
                results.push({key: term, source: source, target: target});
            }
            return results;
        }
    }
}