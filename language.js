'use strict';

module.exports = class Language {

    static RARE = 1e9;
    
    constructor(code) {
        this.code = code;
        // rules for transforming variants to canonical form, e.g. ".*st" -> ".*en"
        this.variantPatterns = [];
        // explicit variants that don't fit a pattern, like rennen -> rannte
        this.explicitVariants = {};
        this.frequency = {};
        this.frequencyCount = 0;
        this.separablePrefixes = [];
    }

    addVariantPattern(variant, canonical, lastResort) {
        //canonical = new RegExp(canonical);
        variant = new RegExp(variant);

        var entry = { variant: variant, canonical: canonical, lastResort: lastResort };
        this.variantPatterns.push(entry);
    }

    addExplicitVariant(canonical, variant) {
        // we store with variant as key because we want to do reverse lookup
        if (!(variant in this.explicitVariants))
            this.explicitVariants[variant] = [];

        return this.explicitVariants[variant].push(canonical);
    }

    getCanonicals(word, lastResort) {
        var canonicals = [];

        if (!lastResort) {
            canonicals = this.explicitVariants[word];
            if (typeof canonicals === 'undefined') {
                // no explicit variants
                canonicals = [];
            }
            else {
                // create a copy
                canonicals = canonicals.slice();
            }
        }

        // derive canonicals from patterns
        this.variantPatterns.forEach(function (value, index, array) {
            if (value.lastResort != lastResort)
                return;
            let canonical = word.replace(value.variant, value.canonical);
            if (canonical != word && ! canonicals.includes(canonical)) {
                //console.log("Canonical: " + word + " -> " + canonical +
                //            " (" + value.variant + " -> " + value.canonical + ")");
                canonicals.push(canonical);
            }
        });

        return canonicals;
    }

    addToFrequencyList(word) {
        // assign rank based on number of words already in the list
        this.frequencyCount++;
        this.frequency[word] = this.frequencyCount;
    }

    getFrequencyRank(word) {
        var res = this.frequency[word];
        if (res == null)
            res = this.frequency[word.toLowerCase()];
        if (res == null) {
            //console.log("Frequency of " + word + " is null");
            return Language.RARE;
        }
        //console.log("Frequency of " + word + " is " + res.toString());
        return res;
    }

    isInFrequencyList(word) {
        if (this.frequency[word] != null)
            return true;
        else if (this.frequency[word.toLowerCase()] != null)
            return true;
        else
            return false;
    }

    getFrequencyListSize() {
        return this.frequencyCount;
    }

    addSeparablePrefix(prefix) {
        this.separablePrefixes.push(prefix);
    }

    getSeparablePrefixes() {
        return this.separablePrefixes;
    }

    isSeparablePrefix(word) {
        return this.separablePrefixes.includes(word);
    }

}