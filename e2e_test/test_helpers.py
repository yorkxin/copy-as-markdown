from e2e_test.helpers import BoundingBox


class TestBoundingBox:
    def test_bounding_box(self):
        bbox = BoundingBox(10, 20, 100, 120)
        assert bbox.left() == 20
        assert bbox.top() == 10
        assert bbox.width() == 100
        assert bbox.height() == 120
        assert bbox.right() == 120
        assert bbox.bottom() == 130
        center = bbox.center()
        assert center.x() == 70
        assert center.y() == 70
        assert bbox.to_tuple() == (20, 10, 120, 130)

    def test_combine_with_superset_bbox(self):
        bbox1 = BoundingBox(20, 20, 80, 80)
        bbox2 = BoundingBox(10, 10, 100, 100)
        combined = bbox1.combine(bbox2)
        assert combined.left() == 10
        assert combined.top() == 10
        assert combined.width() == 100
        assert combined.height() == 100

    def test_combine_with_subset_bbox(self):
        bbox1 = BoundingBox(10, 10, 100, 100)
        bbox2 = BoundingBox(20, 20, 50, 50)
        combined = bbox1.combine(bbox2)
        assert combined.left() == 10
        assert combined.top() == 10
        assert combined.width() == 100
        assert combined.height() == 100

    def test_combine_with_overlapping_bbox(self):
        bbox1 = BoundingBox(10, 10, 100, 100)
        bbox2 = BoundingBox(50, 50, 100, 100)
        combined = bbox1.combine(bbox2)
        assert combined.left() == 10
        assert combined.top() == 10
        assert combined.width() == 140
        assert combined.height() == 140

    def test_combine_with_adjacent_bbox(self):
        bbox1 = BoundingBox(10, 10, 100, 100)
        bbox2 = BoundingBox(110, 10, 100, 100)
        combined = bbox1.combine(bbox2)
        assert combined.left() == 10
        assert combined.top() == 10
        assert combined.width() == 100
        assert combined.height() == 200

    def test_combine_with_non_overlapping_bbox(self):
        bbox1 = BoundingBox(10, 10, 100, 100)
        bbox2 = BoundingBox(120, 10, 100, 100)
        combined = bbox1.combine(bbox2)
        assert combined.left() == 10
        assert combined.top() == 10
        assert combined.width() == 100
        assert combined.height() == 210

