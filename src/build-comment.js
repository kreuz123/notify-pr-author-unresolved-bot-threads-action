function renderTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : match,
  );
}

function buildCommentBody(template, { author, unresolvedCount, threadList }) {
  const mentionsAuthor = template.includes("{author}");
  const values = {
    author: `@${author}`,
    unresolvedCount,
    threadList,
  };
  const message = renderTemplate(template, values);
  const mentionedMessage = mentionsAuthor ? message : `@${author} ${message}`;

  if (template.includes("{threadList}")) {
    return mentionedMessage;
  }

  return `${mentionedMessage}\n\n**Unresolved automated review threads:**\n\n${threadList}`;
}

module.exports = { buildCommentBody };
