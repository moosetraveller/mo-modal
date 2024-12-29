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
        EH.attach('keyup', this._modal, () => {
            if (this.isAcceptingEscapeKey) {
                this.close();
            }
        });

        this._backdrop = this.shadowRoot.querySelector('#backdrop');
        EH.attach('click', this._backdrop, () => {
            if (this.hasCloseableBackdrop) {
                this.close();
            }
            else if (this.hasBackdrop) {
                this._modal.focus();  // redirect focus to modal
            }
        });

        this._render();

    }

    disconnectedCallback() {
        EH.detachAll(this._confirmButton, this._cancelButton, this._backdrop, this._modal);
        EH.detach(`open.${this._uuid}`, Modal._eventBus);
    }

    _render() {
        this._confirmButton.textContent = this.getAttribute('confirmText') ?? 'Confirm';
    }

    _enforceExclusiveness(event) {
        if (this.isOpen && event.detail.uuid !== this._uuid) {
            this.close();
        }
    }

    open() {
        this.setAttribute('opened', '');
    }

    close() {
        this.removeAttribute('opened');
    }

    attributeChangedCallback(name, oldValue, newValue) {

        if (name === 'opened' && oldValue !== newValue) {
            if (this.hasAttribute('opened')) {
                this._modal.focus();
                this._emitOpenedEvent();
            }
            else {
                this._emitClosedEvent();
            }
        }

        this._render();

    }

    static get observedAttributes() {
        return ['opened', 'confirmText'];
    }

    _emitOpenedEvent() {
        const event = new CustomEvent('open', { detail: { uuid: this._uuid } });
        this.dispatchEvent(event);
        Modal._eventBus.dispatchEvent(event);
    }

    _emitClosedEvent() {
        // triggered on the custom component itself and not within the shadow DOM
        this.dispatchEvent(new CustomEvent('close'));
    }

    _emitCancelEvent(clickEvent) {
        // we bubble the event up to the custom component itself
        // if composed is false, the event won't leave the shadow DOM even if bubbles: true
        // easier to call this.dispatchEvent, but leaving that example for further reference
        clickEvent.target.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
    }

    _emitConfirmEvent(clickEvent) {
        clickEvent.target.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
    }

}

customElements.define('mo-modal', Modal);