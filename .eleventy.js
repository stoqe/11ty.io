const chalk = require("chalk");
const htmlmin = require("html-minifier");
const CleanCSS = require("clean-css");
const HumanReadable = require("human-readable-numbers");
const markdownIt = require("markdown-it");
const syntaxHighlightPlugin = require("@11ty/eleventy-plugin-syntaxhighlight");
const loadLanguages = require("prismjs/components/");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");

const rssPlugin = require("@11ty/eleventy-plugin-rss");
const inclusiveLanguagePlugin = require("@11ty/eleventy-plugin-inclusive-language");
const cfg = require("./_data/config.js");

// Load yaml from Prism to highlight frontmatter
loadLanguages(['yaml']);

const shortcodes = {
	avatarlocalcache: function(datasource, slug, alt = "") {
		const avatarMap = require(`./_data/avatarmap/${datasource}.json`);
		if( slug ) {
			let mapEntry = avatarMap[slug.toLowerCase()];
			if(mapEntry && mapEntry.length) {
				let ret = [];
				if( mapEntry.length >= 2 ) {
					ret.push("<picture>");
					ret.push(`<source srcset="/${mapEntry[0].path}" type="image/${mapEntry[0].path.split(".").pop()}">`);
				}
				ret.push(`<img src="${ "/" + mapEntry[mapEntry.length - 1].path }" alt="${alt || `${slug}’s ${datasource} avatar`}" loading="lazy" class="avatar">`);
				if( mapEntry.length >= 2 ) {
					ret.push("</picture>");
				}
				return ret.join("");
			}
		}

		return `<img src="/img/default-avatar.png" alt="${alt}" loading="lazy" class="avatar">`;
	},
	link: function(linkUrl, content) {
		return (linkUrl ? `<a href="${linkUrl}">` : "") +
			content +
			(linkUrl ? `</a>` : "");
	}
};

module.exports = function(eleventyConfig) {
	eleventyConfig.setDataDeepMerge(true);

	eleventyConfig.addPlugin(syntaxHighlightPlugin, {
		templateFormats: "md",
		init: function({ Prism }) {
			Prism.languages.markdown = Prism.languages.extend('markup', {
				'frontmatter': {
					pattern: /^---[\s\S]*?^---$/m,
					greedy: true,
					inside: Prism.languages.yaml
				}
			});
		}
	});
	eleventyConfig.addPlugin(rssPlugin);
	// eleventyConfig.addPlugin(inclusiveLanguagePlugin);
	eleventyConfig.addPlugin(eleventyNavigationPlugin);

	let md = new markdownIt();
	eleventyConfig.addPairedShortcode("callout", function(content, level = "warn", format = "html") {
		if( format === "md" ) {
			content = md.renderInline(content);
		}
		return `<div class="elv-callout elv-callout-${level}">${content}</div>`;
	});

	eleventyConfig.addShortcode("emoji", function(emoji, alt = "") {
		return `<span aria-hidden="true" class="emoji">${emoji}</span>` +
			(alt ? `<span class="sr-only">${alt}</span>` : "");
	});

	eleventyConfig.addShortcode("avatarlocalcache", shortcodes.avatarlocalcache);

	eleventyConfig.addShortcode("codetitle", function(title, heading = "Filename") {
		return `<div class="codetitle codetitle-left"><b>${heading} </b>${title}</div>`;
	});

	eleventyConfig.addPairedShortcode("minilink", function(text, href) {
		return `<a href="${href}" class="minilink minilink-lower">${text}</a>`;
	});

	eleventyConfig.addShortcode("addedin", function(version, tag, extraClass) {
		if( typeof version !== "string" ) {
			tag = version.tag;
			version = version.version;
		}

		tag = tag || "span";

		return `<${tag} class="minilink minilink-addedin${extraClass ? ` ${extraClass}`: ""}">New in v${version}</${tag}>`;
	});

	eleventyConfig.addPassthroughCopy("js");
	eleventyConfig.addPassthroughCopy("css/fonts");
	eleventyConfig.addPassthroughCopy("img");
	eleventyConfig.addPassthroughCopy("favicon.ico");

	eleventyConfig.addFilter("cssmin", function(code) {
		if(process.env.ELEVENTY_PRODUCTION) {
			return new CleanCSS({}).minify(code).styles;
		}

		return code;
	});

	eleventyConfig.addFilter("humanReadableNum", function(num) {
		return HumanReadable.toHumanString(num);
	});

	eleventyConfig.addShortcode("templatelangs", function(languages, page, whitelist, anchor, isinline) {
		let parentTag = isinline ? "span" : "ul";
		let childTag = isinline ? "span" : "li";

		return `<${parentTag} class="inlinelist">${languages.filter(lang => !whitelist ? true : whitelist.indexOf(lang.ext) > -1).map(lang => `<${childTag} class="inlinelist-item${page.url == lang.url ? ' active' : ''}"><a href="${lang.url}${anchor || ''}">${lang.name} <code>*.${lang.ext}</code></a></${childTag}>`).join(" ")}</${parentTag}>`;
	});

	eleventyConfig.addShortcode("latestVersion", function(versions, config, prefix = "v") {
		for( let version of versions ) {
			if( version.tag === "LATEST" ) {
				continue;
			}
			if( !config.prerelease && version.prerelease ) {
				continue;
			}

			return prefix + version.tag.substr(1);
		}
	});

	eleventyConfig.addFilter("orphanWrap", str => {
		let splitSpace = str.split(" ");
		let after = "";
		if( splitSpace.length > 2 ) {
			after += " ";

			// TODO strip HTML from this?
			let lastWord = splitSpace.pop();
			let secondLastWord = splitSpace.pop();

			after += `${secondLastWord}&nbsp;${lastWord}`;
		}

		return splitSpace.join(" ") + after;
	});

	function randomizeArray(arr) {
		let a = arr.slice(0);
		for (let i = a.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	// Thanks to https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
	eleventyConfig.addFilter("shuffle", arr => {
		if( Array.isArray(arr) ) {
			return randomizeArray(arr);
		}

		let keys = randomizeArray(Object.keys(arr));
		let a = {};
		for(let key of keys) {
			a[key] = arr[key];
		}
		return a;
	});

	// Thanks to https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
	eleventyConfig.addFilter("randompick", arr => {
		if( Array.isArray(arr) ) {
			return arr[Math.floor(Math.random() * arr.length)];
		}

		let randkey = Object.keys(arr)[Math.floor(Math.random() * arr.length)];
		return arr[randkey]
	});

	eleventyConfig.addFilter("getsize", arr => {
		if( Array.isArray(arr) ) {
			return arr.length
		}

		return Object.keys(arr).length;
	});

	eleventyConfig.addShortcode("addToSampleSites", function() {
		return `<a href="https://github.com/11ty/11ty.io/issues/new/choose"><strong>Want to add your site to this list?</strong></a>`;
	});

	eleventyConfig.addCollection("quicktipssorted", function(collection) {
		return collection.getFilteredByTag("quicktips").sort(function(a, b) {
			return parseInt(a.data.tipindex, 10) - parseInt(b.data.tipindex, 10);
		});
	});

	eleventyConfig.addShortcode("testimonial", function(testimonial) {
		return `<blockquote><p>${!testimonial.indirect ? `“` : ``}${testimonial.text}${!testimonial.indirect ? `” <span class="bio-source">—${shortcodes.link(testimonial.source, shortcodes.avatarlocalcache("twitter", testimonial.twitter, `${testimonial.name}’s Twitter Photo`) + testimonial.name)}` : ``}</span></p></blockquote>`;
	});

	eleventyConfig.addShortcode("supporterAmount", function(amount) {
		let result = [];
		for( let j = 0, k = amount; j<=k; j+= 50) {
			result.push("❤️");
		}
		return result.join("");
	});

	/* Markdown */
	let markdownItAnchor = require("markdown-it-anchor");
	let markdownItToc = require("markdown-it-table-of-contents");

	function removeExtraText(s) {
		let newStr = String(s).replace(/New\ in\ v\d+\.\d+\.\d+/, "");
		newStr = newStr.replace(/⚠️/g, "");
		newStr = newStr.replace(/[?!]/g, "");
		newStr = newStr.replace(/<[^>]*>/g, "");
		return newStr;
	}

	function markdownItSlugify(s) {
		return encodeURIComponent(removeExtraText(s).trim().toLowerCase().replace(/\s+/g, '-'));
	}

	eleventyConfig.setLibrary("md", markdownIt({
			html: true,
			breaks: true,
			linkify: true
		})
		.use(markdownItAnchor, {
			permalink: true,
			slugify: markdownItSlugify,
			permalinkBefore: false,
			permalinkClass: "direct-link",
			permalinkSymbol: "#",
			level: [1,2,3,4]
		})
		.use(markdownItToc, {
			includeLevel: [2, 3],
			slugify: markdownItSlugify,
			format: function(heading) {
				return removeExtraText(heading);
			}
		})
	);

	// Until https://github.com/valeriangalliat/markdown-it-anchor/issues/58 is fixed
	eleventyConfig.addTransform("remove-aria-hidden-markdown-anchor", function(content, outputPath) {
		if( outputPath.endsWith(".html") ) {
			return content.replace(/ aria\-hidden\=\"true\"\>\#\<\/a\>/g, ` title="Direct link to this heading">#</a>`);
		}

		return content;
	});

	if( cfg.minifyHtml ) {
		eleventyConfig.addTransform("htmlmin", function(content, outputPath) {
			if( process.env.ELEVENTY_PRODUCTION && outputPath.endsWith(".html") ) {
				let minified = htmlmin.minify(content, {
					useShortDoctype: true,
					removeComments: true,
					collapseWhitespace: true
				});
				return minified;
			}

			return content;
		});
	}

	return {
		templateFormats: ["html", "njk", "md", "11ty.js"],
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
		dataTemplateEngine: false,
		passthroughFileCopy: true
	};
};
