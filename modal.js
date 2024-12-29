// CSS module import does not work unless CSS file is explicit served as text/css
// import sheet from './modal.css' assert { type: 'css' }; 

import { EventHandler as EH, loadStyleSheet } from "./utils.js";

/**
 * A simple Modal that could be used to confirm something.
 */
class Modal extends HTMLElement {

    static _styleSheet = null;

    /** for communication between modals */
    static _eventBus = new EventTarget();

    get isOpen() {
        return this.hasAttribute('opened');
    }

    get hasCloseableBackdrop() {
        return !['static', 'false'].includes(this.getAttribute('backdrop'));
    }

    get hasBackdrop() {
        return this.getAttribute('backdrop') !== 'false';
    }

    get isAcceptingEscapeKey() {
        return this.getAttribute('keyboard') !== 'false';
    }

    get triggerElement() {
        return this._triggerElement;
    }

    constructor() {
        
        super();
        this.attachShadow({mode: 'open'});

        this.shadowRoot.innerHTML = `

            <style id="initialStyle">
                
                /* initial style; will be removed when 
                   CSS style sheet was loaded */

                :host {
                    display: none;
                }
                
            </style>

            <div id="backdrop"></div>
            <div id="modal" tabindex="0">

                <header>
                    <slot name="title">Please Confirm</slot>
                </header>

                <section id="content">
                    <slot></slot>
                </section>

                <section id="buttonPanel">
                    <button id="cancelButton">Cancel</button>
                    <button id="confirmButton">Confirm</button>
                </section>

            </div>

        `;

        this._insertStyleSheet('./modal.css');

        this._uuid = crypto.randomUUID();

    }

    /**
     * Inserts style sheet from external file and makes sure that
     * it's only loaded/retrieved once even if the component is
     * used more than once.
     * 
     * @param {string} url url pointing to stylesheet
     */
    async _insertStyleSheet(url) {

        if (Modal._styleSheet === null) {
            Modal._styleSheet = loadStyleSheet(url);
        }

        Modal._styleSheet
            .then(sheet => {
                this.shadowRoot.adoptedStyleSheets = [
                    ...(this.shadowRoot.adoptedStyleSheets || []),
                    sheet,
                ];
                // remove the initial (temporary) style
                const initStyle = this.shadowRoot.querySelector('#initialStyle');
                initStyle?.remove();
            });

    }

    /**
     * This life cycle hook is called when the element is attached to the DOM and ready 
     * to be manipulated.
     */
    connectedCallback() {

        // using helper function EH.attach to add event listeners, in order to remove
        // them easily when disconnectedCallback is called

        EH.attach(`open.${this._uuid}`, Modal._eventBus, this._enforceExclusiveness.bind(this));
        
        this._cancelButton = this.shadowRoot.querySelector('#cancelButton');
        EH.attach('click.cancel', this._cancelButton, (event) => {
            this.close();
            this._emitCancelEvent(event);
        });

        this._confirmButton = this.shadowRoot.querySelector('#confirmButton');
        EH.attach('click.confirm', this._confirmButton, (event) => {
            this.close();
            this._emitConfirmEvent(event);
        });

        this._modal = this.shadowRoot.querySelector('#modal');
        EH.attach('keyup', this._modal, event => {
            if (this.isAcceptingEscapeKey && event.key === 'Escape') {
                this.close();
            }
        });

        this._backdrop = this.shadowRoot.querySelector('#backdrop');
        EH.attach('click', this._backdrop, () => {
            if (this.hasCloseableBackdrop) {
                this.close();
            }
            else if (this.hasBackdrop && this.isAcceptingEscapeKey) {
                this._modal.focus();  // redirect focus to modal
            }
        });

        this._render();

    }

    /**
     * This life cycle hook is called when the custom element is detached from the DOM. Although
     * the event listeners will be removed automatically, it's good practice to do this within
     * this method in case a reference is kept outside of the element. 
     */
    disconnectedCallback() {
        EH.detachAll(this._confirmButton, this._cancelButton, this._backdrop, this._modal);
        // if we wouldn't remove the following listener explicitly, it would remain
        EH.detach(`open.${this._uuid}`, Modal._eventBus);
    }

    /**
     * Renders this component.
     */
    _render() {
        this._confirmButton.textContent = this.getAttribute('confirmText') ?? 'Confirm';
    }

    /**
     * Closes the modal if the event's source (another modal) is not the current one.
     * 
     * @param {CustomEvent} event 
     */
    _enforceExclusiveness(event) {
        if (this.isOpen && event.detail.uuid !== this._uuid) {
            this.close();
        }
    }

    /**
     * Opens the modal.
     */
    open() {
        this.setAttribute('opened', '');
    }

    /**
     * Closes the modal.
     */
    close() {
        this.removeAttribute('opened');
    }

    /**
     * Toggles the visibility of the modal. If open, the modal will be closed
     * and vice versa.
     */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * This life cycle hook is called when the value of an observed attribute is changed.
     * 
     * @param {string} name attribute name (must be included in `observedAttributes`)
     * @param {string} oldValue old/previous value
     * @param {string} newValue new/next value
     */
    attributeChangedCallback(name, oldValue, newValue) {

        if (name === 'opened' && oldValue !== newValue) {
            if (this.hasAttribute('opened')) {
                if (!this.shadowRoot.contains(document.activeElement)) {
                    this._triggerElement = document.activeElement;
                }
                this._modal.focus();
                this._emitOpenedEvent();
            }
            else {
                this._triggerElement?.focus();
                this._emitClosedEvent();
            }
        }

        this._render();

    }

    /**
     * Returns an array of observed attributes. When these attributes change
     * `attributeChangedCallback` is called, otherwise, the method is not.
     */
    static get observedAttributes() {
        return ['opened', 'confirmText'];
    }

    /**
     * Emits a custom event `open`.
     */
    _emitOpenedEvent() {
        const event = new CustomEvent('open', { detail: { uuid: this._uuid } });
        this.dispatchEvent(event);
        Modal._eventBus.dispatchEvent(event);
    }

    /**
     * Emits a custom event `close`.
     */
    _emitClosedEvent() {
        // triggered on the custom component itself and not within the shadow DOM
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Emits a custom event `cancel`.
     */
    _emitCancelEvent(clickEvent) {
        // we bubble the event up to the custom component itself
        // if composed is false, the event won't leave the shadow DOM even if bubbles: true
        // easier to call this.dispatchEvent, but leaving that example for further reference
        clickEvent.target.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
    }

    /**
     * Emits a custom event `confirm`.
     */
    _emitConfirmEvent(clickEvent) {
        clickEvent.target.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
    }

}

customElements.define('mo-modal', Modal);