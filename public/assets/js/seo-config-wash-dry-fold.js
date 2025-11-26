// SEO Configuration for Wash-Dry-Fold Service Page
// This data is sent to the parent page for meta tag injection

window.WashDryFoldSEOConfig = {
    // Page title and meta tags
    meta: {
        title: "Wash-Dry-Fold Laundry Service Austin TX | $1.20/lb | WaveMAX",
        description: "Austin's best wash-dry-fold service with hospital-grade UV sanitization. $1.20/lb, 24-hour turnaround, pickup & delivery available. Save 62 hours per year! Open 7AM-10PM daily.",
        keywords: "wash dry fold Austin, laundry service Austin TX, laundry pickup delivery Austin, wash and fold near me, laundry delivery service Austin, UV sanitized laundry Austin, same day laundry Austin, professional laundry service Austin",
        author: "WaveMAX Laundry",
        canonicalUrl: "https://www.wavemaxlaundry.com/austin-tx/wash-dry-fold/"
    },

    // Open Graph tags for social sharing
    openGraph: {
        title: "Wash-Dry-Fold Laundry Service Austin | $1.20/lb with UV Sanitization",
        description: "Save 62 hours per year with Austin's premier wash-dry-fold service. Hospital-grade UV sanitization, 24-hour turnaround, pickup & delivery available. Just $1.20/lb with professional care.",
        type: "business.business",
        url: "https://www.wavemaxlaundry.com/austin-tx/wash-dry-fold/",
        image: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=1200&h=630&auto=format&fit=crop",
        imageWidth: "1200",
        imageHeight: "630",
        siteName: "WaveMAX Laundry",
        locale: "en_US"
    },

    // Twitter Card tags
    twitter: {
        card: "summary_large_image",
        site: "@wavemaxlaundry",
        title: "Wash-Dry-Fold Laundry Service Austin | $1.20/lb with UV Sanitization",
        description: "Save 62 hours per year with Austin's premier wash-dry-fold service. Hospital-grade UV sanitization, 24-hour turnaround, pickup & delivery available.",
        image: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=1200&h=630&auto=format&fit=crop",
        imageAlt: "Freshly folded laundry from professional wash-dry-fold service"
    },

    // Structured Data - LocalBusiness Schema
    structuredData: {
        localBusiness: {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": "https://www.wavemaxlaundry.com/austin-tx/#localbusiness",
            "name": "WaveMAX Laundry Austin",
            "image": [
                "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=1200&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=1200&auto=format&fit=crop"
            ],
            "description": "Austin's premier wash-dry-fold laundry service featuring hospital-grade UV sanitization technology. $1.20/lb pricing with 24-hour guaranteed turnaround. Pickup and delivery available throughout Austin. Save 62 hours per year with professional laundry care.",
            "url": "https://www.wavemaxlaundry.com/austin-tx/",
            "telephone": "+15122530953",
            "priceRange": "$$",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "825 E Rundberg Ln f1",
                "addressLocality": "Austin",
                "addressRegion": "TX",
                "postalCode": "78753",
                "addressCountry": "US"
            },
            "geo": {
                "@type": "GeoCoordinates",
                "latitude": "30.3357",
                "longitude": "-97.7035"
            },
            "openingHoursSpecification": [
                {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday"
                    ],
                    "opens": "07:00",
                    "closes": "22:00"
                }
            ],
            "paymentAccepted": "Cash, Credit Card, Debit Card",
            "currenciesAccepted": "USD",
            "areaServed": [
                {
                    "@type": "City",
                    "name": "Austin",
                    "@id": "https://en.wikipedia.org/wiki/Austin,_Texas"
                },
                {
                    "@type": "City",
                    "name": "Round Rock"
                },
                {
                    "@type": "City",
                    "name": "Pflugerville"
                }
            ],
            "sameAs": [
                "https://www.facebook.com/wavemaxlaundry",
                "https://www.instagram.com/wavemaxlaundry"
            ],
            "amenityFeature": [
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "UV Sanitization",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "24-Hour Turnaround",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "Professional Folding",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "Individual Washing",
                    "value": true
                }
            ],
            "hasMap": "https://maps.app.goo.gl/oD7VC5KKxXQvajci6"
        },

        // Service Schema
        service: {
            "@context": "https://schema.org",
            "@type": "Service",
            "@id": "https://www.wavemaxlaundry.com/austin-tx/wash-dry-fold/#service",
            "serviceType": "Wash-Dry-Fold Laundry Service",
            "name": "Wash-Dry-Fold Service",
            "description": "Professional wash-dry-fold laundry service with hospital-grade UV sanitization. We pick up, wash, dry, and fold your laundry with 24-hour guaranteed turnaround. Individual washing ensures your clothes are never mixed with others. Pickup and delivery available throughout Austin.",
            "provider": {
                "@type": "LocalBusiness",
                "name": "WaveMAX Laundry Austin",
                "@id": "https://www.wavemaxlaundry.com/austin-tx/#localbusiness"
            },
            "areaServed": [
                {
                    "@type": "City",
                    "name": "Austin",
                    "sameAs": "https://en.wikipedia.org/wiki/Austin,_Texas"
                },
                {
                    "@type": "City",
                    "name": "Round Rock"
                },
                {
                    "@type": "City",
                    "name": "Pflugerville"
                }
            ],
            "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Wash-Dry-Fold Services",
                "itemListElement": [
                    {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "name": "Wash-Dry-Fold Service",
                            "description": "Professional wash, dry, and fold service with UV sanitization at $1.20 per pound"
                        },
                        "price": "1.20",
                        "priceCurrency": "USD",
                        "priceSpecification": {
                            "@type": "UnitPriceSpecification",
                            "price": "1.20",
                            "priceCurrency": "USD",
                            "referenceQuantity": {
                                "@type": "QuantitativeValue",
                                "value": "1",
                                "unitCode": "LBR"
                            }
                        },
                        "eligibleQuantity": {
                            "@type": "QuantitativeValue",
                            "minValue": "20",
                            "unitText": "USD"
                        }
                    },
                    {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "name": "UV Sanitization",
                            "description": "Hospital-grade UV sanitization providing 99.999% pathogen elimination"
                        }
                    }
                ]
            },
            "termsOfService": "24-hour turnaround guarantee. Individual washing - your clothes never mixed with others. Special care for delicate items.",
            "availableChannel": {
                "@type": "ServiceChannel",
                "servicePhone": {
                    "@type": "ContactPoint",
                    "telephone": "+15122530953",
                    "contactType": "Customer Service"
                },
                "serviceLocation": {
                    "@type": "Place",
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": "825 E Rundberg Ln f1",
                        "addressLocality": "Austin",
                        "addressRegion": "TX",
                        "postalCode": "78753"
                    }
                }
            }
        },

        // BreadcrumbList Schema
        breadcrumb: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://www.wavemaxlaundry.com/"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Austin TX",
                    "item": "https://www.wavemaxlaundry.com/austin-tx/"
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": "Wash-Dry-Fold Service",
                    "item": "https://www.wavemaxlaundry.com/austin-tx/wash-dry-fold/"
                }
            ]
        },

        // Product/Service Schema with Reviews
        product: {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Professional Wash-Dry-Fold Laundry Service",
            "description": "Premium wash-dry-fold service with hospital-grade UV sanitization, 24-hour turnaround, and pickup and delivery available throughout Austin.",
            "brand": {
                "@type": "Brand",
                "name": "WaveMAX Laundry"
            },
            "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "24.00",
                "highPrice": "48.00",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": "https://www.wavemaxlaundry.com/austin-tx/wash-dry-fold/",
                "priceSpecification": {
                    "@type": "UnitPriceSpecification",
                    "price": "1.20",
                    "priceCurrency": "USD",
                    "referenceQuantity": {
                        "@type": "QuantitativeValue",
                        "value": "1",
                        "unitCode": "LBR"
                    }
                }
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "reviewCount": "247",
                "bestRating": "5",
                "worstRating": "1"
            }
        },

        // FAQ Schema
        faq: {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "How much does the wash-dry-fold service cost?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Our wash-dry-fold service costs $1.20 per pound with a $20 minimum order (approximately 17 lbs). Pickup and delivery, UV sanitization, professional folding, and all supplies are included in this price—no hidden fees."
                    }
                },
                {
                    "@type": "Question",
                    "name": "What's the turnaround time for laundry service?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "We guarantee 24-hour turnaround from pickup to delivery. Drop off or schedule pickup during our business hours (7AM-10PM), and we'll have your laundry back to you within 24 hours, fresh and perfectly folded."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Are my clothes washed separately from others?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Absolutely! Your laundry is NEVER mixed with other customers' clothes. We wash each customer's order individually to ensure the highest quality care and maintain hygiene standards."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Is UV sanitization safe for all fabrics?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes! UV sanitization is safe for all fabric types, unlike bleach which can damage delicates and colors. The process leaves no chemical residue and is gentle on fabrics while being tough on germs, eliminating 99.999% of pathogens including COVID-19, MRSA, E. coli, and C. diff."
                    }
                },
                {
                    "@type": "Question",
                    "name": "What areas do you serve for pickup and delivery?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "We serve all of Austin including North Austin, South Austin, Downtown, East Austin, West Austin, as well as Round Rock and Pflugerville. Visit us at 825 E Rundberg Ln f1, Austin, TX 78753."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Do you handle delicate items and special fabrics?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes! We provide special care for delicate fabrics, dresses, collared shirts, and dress pants. These items receive professional attention including proper hanging to minimize wrinkles. Let us know if you have special care instructions."
                    }
                },
                {
                    "@type": "Question",
                    "name": "What detergents and products do you use?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "We use premium brands like Tide, OxiClean, Downy, and Spray 'n Wash. We also offer organic and hypoallergenic alternatives for customers with sensitive skin or environmental preferences. Just let us know your preference!"
                    }
                },
                {
                    "@type": "Question",
                    "name": "What payment methods do you accept?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "We accept all major credit cards, debit cards, and cash. Payment is easy and secure, and you don't need to worry about carrying quarters or exact change!"
                    }
                }
            ]
        }
    }
};
