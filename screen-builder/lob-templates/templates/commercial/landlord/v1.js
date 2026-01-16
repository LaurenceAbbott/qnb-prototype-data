{
  "meta": {
    "version": 1,
    "createdAt": "2026-01-16T15:27:37Z",
    "updatedAt": "2026-01-16T15:27:37Z",
    "questionArrays": [],
    "previewMode": "page"
  },
  "lineOfBusiness": "Landlord Insurance Quote",
  "pages": [
    {
      "id": "page_e410d5e30daa",
      "name": "Get a landlord insurance quote",
      "template": "form",
      "flow": [
        {
          "type": "text",
          "id": "txt_e4c0cb328bf9",
          "title": "Get a landlord insurance quote",
          "level": "h1",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_b7c9cb1a8b02"
        }
      ],
      "groups": [
        {
          "id": "group_b7c9cb1a8b02",
          "name": "Before we start",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_f6de9f8340fe",
              "type": "display",
              "title": "Landlord Insurance",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "hero",
                "tone": "neutral",
                "title": "Landlord Insurance",
                "subtitle": "Landlord Insurance",
                "bodyHtml": "<p>We\u2019ll ask about your property, the tenants and the cover you need.</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_7a1433fd6698",
              "type": "date",
              "title": "When do you want cover to start?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_1f4a6afc1896",
              "type": "yesno",
              "title": "Are you a UK resident?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_5e15502e34f7",
      "name": "Policyholder",
      "template": "form",
      "flow": [
        {
          "type": "text",
          "id": "txt_8de054e48913",
          "title": "Policyholder",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_8170e0e98885"
        }
      ],
      "groups": [
        {
          "id": "group_8170e0e98885",
          "name": "Your details",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_c99f41067ed7",
              "type": "select",
              "title": "Title",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Mr",
                "Mrs",
                "Miss",
                "Ms",
                "Mx",
                "Dr"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_e6283239c74a",
              "type": "text",
              "title": "First name",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_f25dd2468d0b",
              "type": "text",
              "title": "Last name",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_75441b63c1c4",
              "type": "date",
              "title": "Date of birth",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_5b7cc586faa3",
              "type": "email",
              "title": "Email address",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_40efce8b8fc8",
              "type": "tel",
              "title": "Phone number",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_dc461e0abf50",
              "type": "text",
              "title": "Address line 1",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_e3704bd82b03",
              "type": "text",
              "title": "Address line 2",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_e5fbb81d8acf",
              "type": "text",
              "title": "Town/City",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_5d935d988c65",
              "type": "text",
              "title": "Postcode",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_341075844430",
              "type": "yesno",
              "title": "Is the policyholder a company?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_3ede89f04d55",
              "type": "text",
              "title": "Company name",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_95da71cac5eb",
      "name": "Property details",
      "template": "form",
      "flow": [
        {
          "type": "text",
          "id": "txt_04ad521d78fe",
          "title": "Property details",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_e1ecd910fee9"
        }
      ],
      "groups": [
        {
          "id": "group_e1ecd910fee9",
          "name": "Add properties",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_80bba77f8c8e",
              "type": "display",
              "title": "If you have multiple rental properties, add each one here.",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "If you have multiple rental properties, add each one here.",
                "subtitle": "",
                "bodyHtml": "<p>If you have multiple rental properties, add each one here.</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_8079170a4b86",
              "type": "display",
              "title": "Properties (prototype)",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "Properties",
                "subtitle": "",
                "bodyHtml": "<p>This section supports multiple items in a full build. For this prototype we\u2019ll capture one item.</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_f6d641a8cd72",
              "type": "text",
              "title": "Property nickname",
              "required": false,
              "help": "e.g. 'High Street Flat'",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_84d44c560255",
              "type": "select",
              "title": "Property type",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "House",
                "Flat",
                "Bungalow",
                "Maisonette",
                "HMO",
                "Other"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_a7ceb05a6a0d",
              "type": "number",
              "title": "Number of bedrooms",
              "required": true,
              "help": "Min 0, Max 20",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_5634ed12760d",
              "type": "number",
              "title": "Year built (approx)",
              "required": false,
              "help": "Min 1600, Max 2026",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_a3b0552492a3",
              "type": "select",
              "title": "Wall construction",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Brick/stone",
                "Timber frame",
                "Non-standard"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_e945b2ec905f",
              "type": "select",
              "title": "Roof construction",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Tile/slate",
                "Thatched",
                "Flat roof",
                "Other"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_55e3ecab43d9",
              "type": "yesno",
              "title": "Is the property listed?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_21054d9a0ee4",
              "type": "number",
              "title": "Rebuild cost (\u00a3)",
              "required": true,
              "help": "Min 0",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_3383ee664eda",
              "type": "yesno",
              "title": "Do you need contents cover?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_6add7b94131b",
              "type": "number",
              "title": "Contents sum insured (\u00a3)",
              "required": true,
              "help": "Min 0",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_ad66c3b88f34",
              "type": "text",
              "title": "Address line 1",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_310aff94d2b9",
              "type": "text",
              "title": "Town/City",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_79f53277949f",
              "type": "text",
              "title": "Postcode",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_d9360298ba48",
      "name": "Tenancy & add-ons",
      "template": "form",
      "flow": [
        {
          "type": "text",
          "id": "txt_dde8665b6b70",
          "title": "Tenancy & add-ons",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_e64933bed5a7"
        }
      ],
      "groups": [
        {
          "id": "group_e64933bed5a7",
          "name": "Tenancy details",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_e1b66d6e0018",
              "type": "select",
              "title": "Tenant type",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Single family",
                "Professional sharers",
                "Students",
                "DSS/Universal Credit",
                "Holiday let",
                "HMO"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_0f989647c23f",
              "type": "yesno",
              "title": "Will the property be unoccupied for more than 30 days?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_ddcb9c5892c0",
              "type": "number",
              "title": "How many days (approx)?",
              "required": true,
              "help": "Min 31, Max 365",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_4a6edc50714a",
              "type": "number",
              "title": "Annual rent (\u00a3)",
              "required": true,
              "help": "Min 0",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_a1b115a61afb",
              "type": "yesno",
              "title": "Add rent protection cover?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_3448cabfaec1",
              "type": "yesno",
              "title": "Add legal expenses cover?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_542231a1d131",
      "name": "Insurance history",
      "template": "form",
      "flow": [
        {
          "type": "text",
          "id": "txt_36c873ca5849",
          "title": "Insurance history",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_8652dbbf8e4d"
        }
      ],
      "groups": [
        {
          "id": "group_8652dbbf8e4d",
          "name": "Previous insurance",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_f781ed732360",
              "type": "yesno",
              "title": "Any property claims in the last 5 years?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_203612d07220",
              "type": "display",
              "title": "Claims (prototype)",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "Claims",
                "subtitle": "",
                "bodyHtml": "<p>This section supports multiple items in a full build. For this prototype we\u2019ll capture one item.</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_55d7c3908a82",
              "type": "date",
              "title": "When did the claim happen?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_ac4e08ab3fcc",
              "type": "select",
              "title": "What type of claim was it?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Accident",
                "Theft",
                "Fire",
                "Windscreen",
                "Malicious damage",
                "Other"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_ae7439848519",
              "type": "number",
              "title": "Approximate cost (\u00a3)",
              "required": false,
              "help": "Min 0",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_d9897e620fab",
              "type": "radio",
              "title": "Were you at fault?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No",
                "Partly"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_760d1bf62854",
              "type": "yesno",
              "title": "Have you ever had insurance declined, cancelled or voided?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Yes",
                "No"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_706709ca8c01",
              "type": "text",
              "title": "Please tell us more",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_f749176129f4",
      "name": "Your quote",
      "template": "quote",
      "flow": [
        {
          "type": "text",
          "id": "txt_96f76292c818",
          "title": "Your quote",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_55d689fa78bf"
        }
      ],
      "groups": [
        {
          "id": "group_55d689fa78bf",
          "name": "Payment options",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_e7bfdbf5c815",
              "type": "display",
              "title": "Here\u2019s your indicative quote. You can choose annual or monthly payments.",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "Here\u2019s your indicative quote. You can choose annual or monthly payments.",
                "subtitle": "",
                "bodyHtml": "<p>Here\u2019s your indicative quote. You can choose annual or monthly payments.</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_f1ad9ad6573f",
              "type": "radio",
              "title": "How would you like to pay?",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "annual",
                "monthly"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_2cba771ab87d",
              "type": "display",
              "title": "quote",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "quote",
                "subtitle": "",
                "bodyHtml": "<p>[quote]</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_67e470bf28cb",
              "type": "display",
              "title": "**Typical cover**\n- Buildings (sum insured)\n- Landlord liability\n- Loss of rent ",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "**Typical cover**\n- Buildings (sum insured)\n- Landlord liability\n- Loss of rent ",
                "subtitle": "",
                "bodyHtml": "<p><strong>Typical cover</strong></p><ul><li>Buildings (sum insured)</li><li>Landlord liability</li><li>Loss of rent (where selected)</li></ul>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_c5b224677c5d",
              "type": "display",
              "title": "**Common exclusions**\n- Wear and tear\n- Poor maintenance\n- Unoccupied beyond the",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "**Common exclusions**\n- Wear and tear\n- Poor maintenance\n- Unoccupied beyond the",
                "subtitle": "",
                "bodyHtml": "<p><strong>Common exclusions</strong></p><ul><li>Wear and tear</li><li>Poor maintenance</li><li>Unoccupied beyond the allowed period</li></ul>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_e3a6f1794613",
      "name": "Check your details",
      "template": "summary",
      "flow": [
        {
          "type": "text",
          "id": "txt_9c00675b71b5",
          "title": "Check your details",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_a584a274aa2c"
        }
      ],
      "groups": [
        {
          "id": "group_a584a274aa2c",
          "name": "Your answers",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_ab6be85e26f8",
              "type": "display",
              "title": "summary",
              "required": false,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "summary",
                "subtitle": "",
                "bodyHtml": "<p>[summary]</p>",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_eb346c1a8781",
              "type": "checkbox",
              "title": "Confirm",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "I confirm the details are correct"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "page_300f069da7dc",
      "name": "Payment",
      "template": "payment",
      "flow": [
        {
          "type": "text",
          "id": "txt_6608c8c660f7",
          "title": "Payment",
          "level": "h2",
          "bodyHtml": ""
        },
        {
          "type": "group",
          "id": "group_2213bde5147b"
        }
      ],
      "groups": [
        {
          "id": "group_2213bde5147b",
          "name": "How you\u2019ll pay",
          "description": {
            "enabled": false,
            "html": "<p></p>"
          },
          "logic": {
            "enabled": false,
            "rules": []
          },
          "questions": [
            {
              "id": "q_3f3e9a8e766d",
              "type": "radio",
              "title": "Payment method",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "Debit card",
                "Direct Debit"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            },
            {
              "id": "q_9691035a152e",
              "type": "checkbox",
              "title": "Agreements",
              "required": true,
              "help": "",
              "placeholder": "",
              "errorText": "",
              "options": [
                "I agree to the terms and conditions",
                "I confirm I have answered all questions honestly"
              ],
              "logic": {
                "enabled": false,
                "rules": []
              },
              "content": {
                "enabled": false,
                "html": ""
              },
              "display": {
                "variant": "info",
                "tone": "neutral",
                "title": "",
                "subtitle": "",
                "bodyHtml": "",
                "prefix": "",
                "suffix": ""
              },
              "followUp": {
                "enabled": false,
                "triggerValue": "Yes",
                "name": "",
                "questions": [],
                "repeat": {
                  "enabled": false,
                  "min": 1,
                  "max": 5,
                  "addLabel": "Add another",
                  "itemLabel": "Item"
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
