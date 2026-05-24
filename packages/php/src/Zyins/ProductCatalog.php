<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * In-memory catalog of known products.
 *
 * Two construction paths:
 *   - {@see ProductCatalog::default()} — the static built-in list; always available.
 *   - {@see ProductCatalog::fromDatasets()} — built from a live datasets bundle so
 *     the catalog stays in sync with the server.
 *
 * {@see find()} and {@see findBySlug()} are the documented entry points.
 */
final class ProductCatalog
{
    /** @var Product[] */
    private array $products;

    /** @param Product[] $products */
    private function __construct(array $products)
    {
        $this->products = array_values($products);
    }

    /**
     * The default catalog shipped with the SDK.
     */
    public static function default(): self
    {
        return new self(self::defaultProducts());
    }

    /**
     * Build a catalog from a datasets bundle returned by
     * `$client->datasets->get(include: ['products'])`.
     *
     * The `products` field in the bundle is a map of product-class keys to
     * arrays of raw product entry objects. Entries missing required fields
     * are silently skipped.
     *
     * @param array<string,mixed> $bundle
     */
    public static function fromDatasets(array $bundle): self
    {
        $productsData = $bundle['products'] ?? null;
        if (! is_array($productsData)) {
            return new self([]);
        }

        $products = [];
        foreach ($productsData as $value) {
            if (! is_array($value)) {
                continue;
            }
            foreach ($value as $entry) {
                $product = self::rawEntryToProduct($entry);
                if ($product !== null) {
                    $products[] = $product;
                }
            }
        }

        return new self($products);
    }

    /**
     * Look up a product by brand and type. Throws if no match.
     *
     * @throws \OutOfBoundsException
     */
    public function find(string $brand, ProductType $type): Product
    {
        $found = $this->tryFind($brand, $type);
        if ($found === null) {
            throw new \OutOfBoundsException(
                "ProductCatalog::find: no product matches brand={$brand} type={$type->value}"
            );
        }
        return $found;
    }

    /**
     * Soft variant of {@see find()}; returns `null` if no match.
     */
    public function tryFind(string $brand, ProductType $type): ?Product
    {
        foreach ($this->products as $product) {
            if ($product->brand === $brand && $product->type === $type) {
                return $product;
            }
        }
        return null;
    }

    /**
     * Look up a product by its wire token slug (e.g. `"fex-aetna-accendo"`).
     * Throws if no match; use {@see tryFindBySlug()} for a soft-miss path.
     *
     * @throws \OutOfBoundsException
     */
    public function findBySlug(string $slug): Product
    {
        $found = $this->tryFindBySlug($slug);
        if ($found === null) {
            throw new \OutOfBoundsException(
                "ProductCatalog::findBySlug: no product matches slug={$slug}"
            );
        }
        return $found;
    }

    /**
     * Soft variant of {@see findBySlug()}; returns `null` if no match.
     */
    public function tryFindBySlug(string $slug): ?Product
    {
        foreach ($this->products as $product) {
            if ($product->wireToken === $slug) {
                return $product;
            }
        }
        return null;
    }

    /**
     * All products in the catalog.
     *
     * @return Product[]
     */
    public function list(): array
    {
        return $this->products;
    }

    /** @param mixed $entry */
    private static function rawEntryToProduct($entry): ?Product
    {
        if (! is_array($entry)) {
            return null;
        }
        $identifier = self::nonEmptyString($entry['identifier'] ?? null);
        $carrier    = self::nonEmptyString($entry['carrier'] ?? null);
        $name       = self::nonEmptyString($entry['name'] ?? null);
        if ($identifier === null || $carrier === null || $name === null) {
            return null;
        }
        $productClass = self::nonEmptyString($entry['product'] ?? null);
        if ($productClass === null) {
            return null;
        }
        $type = self::mapProductClass($productClass);
        if ($type === null) {
            return null;
        }

        try {
            return new Product(
                brand:       $carrier,
                type:        $type,
                wireToken:   $identifier,
                displayName: $name,
            );
        } catch (\InvalidArgumentException) {
            return null;
        }
    }

    private static function mapProductClass(string $cls): ?ProductType
    {
        return match (strtolower($cls)) {
            'fex', 'final_expense'        => ProductType::FinalExpense,
            'term'                        => ProductType::Term,
            'wl', 'whole_life', 'wholelife' => ProductType::WholeLife,
            'medsup', 'medicare_supplement' => ProductType::MedicareSupplement,
            'ul', 'universal'             => ProductType::Universal,
            'indexed'                     => ProductType::Indexed,
            default                       => null,
        };
    }

    private static function nonEmptyString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    /** @return Product[] */
    private static function defaultProducts(): array
    {
        return [
            new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'Colonial Penn Final Expense'),
            new Product('mutual-of-omaha', ProductType::FinalExpense, 'mutual-of-omaha.final-expense', 'Mutual of Omaha Final Expense'),
            new Product('aetna', ProductType::MedicareSupplement, 'aetna.medicare-supplement', 'Aetna Medicare Supplement'),
        ];
    }
}
