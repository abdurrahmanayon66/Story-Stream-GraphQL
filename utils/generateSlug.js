const slugify = require("slugify");

/**
 * Generates a unique, SEO-friendly slug for a blog title.
 * @param {string} title - The blog title
 * @param {function} checkExists - Async function to check if the slug exists in the database
 * @returns {Promise<string>} - A unique slug
 */
const generateSlug = async (title, checkExists) => {
  let baseSlug = slugify(title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });

  let slug = baseSlug;
  let suffix = 1;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return slug;
};

module.exports = generateSlug;
