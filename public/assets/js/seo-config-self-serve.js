// SEO Configuration for Self-Serve Laundry Page
// This data is sent to the parent page for meta tag injection

window.SelfServeSEOConfig = {
    // Page title and meta tags
    meta: {
        title: "Self-Service Laundry Austin TX | WaveMAX Laundromat",
        description: "Austin's premier self-service laundry with 450G machines, UV sanitization & touchless payment. Open 7AM-10PM daily. Fast, clean, affordable laundry service in Austin, TX.",
        keywords: "self-service laundry Austin, laundromat Austin TX, wash and fold Austin, laundromat near me Austin, UV sanitization laundry, 450G washers Austin",
        author: "WaveMAX Laundry",
        canonicalUrl: "https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/"
    },

    // Open Graph tags for social sharing
    openGraph: {
        title: "Self-Service Laundry Austin TX | WaveMAX - 450G Machines & UV Sanitization",
        description: "Austin's premier self-service laundromat with state-of-the-art 450G washers, UV sanitization, and touchless payment. Open 7AM-10PM daily. Fast, clean, affordable laundry in Austin, TX.",
        type: "business.business",
        url: "https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/",
        image: "https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/sua1.jpg",
        imageWidth: "1200",
        imageHeight: "630",
        siteName: "WaveMAX Laundry",
        locale: "en_US"
    },

    // Twitter Card tags
    twitter: {
        card: "summary_large_image",
        site: "@wavemaxlaundry",
        title: "Self-Service Laundry Austin TX | WaveMAX - 450G Machines & UV Sanitization",
        description: "Austin's premier self-service laundromat with state-of-the-art 450G washers, UV sanitization, and touchless payment. Open 7AM-10PM daily.",
        image: "https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/sua1.jpg",
        imageAlt: "Modern laundromat interior with high-capacity washers and dryers"
    },

    // Structured Data - LocalBusiness Schema
    structuredData: {
        localBusiness: {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": "https://www.wavemaxlaundry.com/austin-tx/#localbusiness",
            "name": "WaveMAX Laundry Austin",
            "image": [
                "https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/sua1.jpg",
                "https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/sua2.jpg",
                "https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/sua3.jpg"
            ],
            "description": "Austin's premier self-service laundromat featuring 450G capacity washers and dryers with UV sanitization technology. Open 7AM-10PM daily, 365 days a year with touchless payment, free WiFi, and wash-dry-fold services.",
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
            "areaServed": {
                "@type": "City",
                "name": "Austin",
                "@id": "https://en.wikipedia.org/wiki/Austin,_Texas"
            },
            "sameAs": [
                "https://www.facebook.com/wavemaxlaundry",
                "https://www.instagram.com/wavemaxlaundry"
            ],
            "amenityFeature": [
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "Free WiFi",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "Wheelchair Accessible",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "Free Parking",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "UV Sanitization",
                    "value": true
                },
                {
                    "@type": "LocationFeatureSpecification",
                    "name": "Touchless Payment",
                    "value": true
                }
            ],
            "hasMap": "https://maps.app.goo.gl/oD7VC5KKxXQvajci6"
        },

        // Service Schema
        service: {
            "@context": "https://schema.org",
            "@type": "Service",
            "@id": "https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/#service",
            "serviceType": "Self-Service Laundry",
            "name": "Self-Service Laundry",
            "description": "State-of-the-art self-service laundry facility with 450G capacity washers and dryers, UV sanitization, and touchless payment systems.",
            "provider": {
                "@type": "LocalBusiness",
                "name": "WaveMAX Laundry Austin",
                "@id": "https://www.wavemaxlaundry.com/austin-tx/#localbusiness"
            },
            "areaServed": {
                "@type": "City",
                "name": "Austin",
                "sameAs": "https://en.wikipedia.org/wiki/Austin,_Texas"
            },
            "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Laundry Services",
                "itemListElement": [
                    {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "name": "Self-Service Washing",
                            "description": "High-capacity 450G washers with multiple load sizes from 20 lbs to 80 lbs"
                        }
                    },
                    {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "name": "Self-Service Drying",
                            "description": "High-efficiency dryers with UV sanitization technology"
                        }
                    },
                    {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "name": "Wash-Dry-Fold Service",
                            "description": "Same-day wash, dry, and fold service with professional care"
                        }
                    }
                ]
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
                    "name": "Self-Service Laundry",
                    "item": "https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/"
                }
            ]
        }
    }
};
