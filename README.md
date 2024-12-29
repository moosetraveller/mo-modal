# Modal Web Component

A simple implementation of a JavaScript modal using web components.

## Why using `<dialog>` within the custom element

By using `<dialog>`, we'll take advantage over the accessibility features of `<dialog>` such as an `aria-hidden` management and focus trapping. 

Why not just extending `<dialog>` itself as a customized built-in element? Customized built-in element are not (yet; or never will be) supported by Safari.

## Note

This is a learning project and not intended to be used in a productive environment. Some code is not optimized, or/and should be simplified. 

Also, there is additional boilerplate code that is unnecessary but kept (or introduced) to explore certain features and serve as a form of note-taking.
